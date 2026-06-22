// onnxruntime-web and some of its transitive dependencies reference `window`.
// Service workers have no `window`; aliasing globalThis before any imports
// resolves these checks without breaking the APIs we actually use.
if (typeof window === "undefined") {
  (globalThis as unknown as Record<string, unknown>).window = globalThis;
}

import { defineBackground } from "wxt/sandbox";
import { registerMessageRouter } from "../src/messaging/router";
import { analyzeUrl, disabledAnalysis } from "../src/detection/analyzeUrl";
import {
  getAuditStore,
  getPrefixDb,
  getSettingsStore,
  getTrainingStore,
  getVerdictCache,
} from "../src/storage";
import type { ExtensionRequest, ExtensionResponse } from "../src/shared/messages";
import { makeErrorResponse } from "../src/shared/messages";
import { buildTemplateExplanation } from "../src/explanations/templateExplanation";
import { buildWebLlmExplanationWithFallback } from "../src/explanations/webllmExplanation";
import { SafeBrowsingClient } from "../src/threat-intel/safeBrowsing";
import { runPrivacyVerification } from "../src/privacy/verifier";
import { MlClient } from "../src/ml/mlClient";
import { OnnxPredictor } from "../src/ml/onnxPredictor";
import { VisualClient } from "../src/visual/visualClient";
import { OffscreenImageSource } from "../src/visual/offscreenImageSource";
import { applyVisualResult } from "../src/detection/applyVisualResult";
import { parseUrl } from "../src/rules/parseUrl";
import { buildTrainingCard, type TrainingCard } from "../src/ui/popup/buildTrainingCard";
import { buildLlmTrainingCardWithFallback } from "../src/explanations/llmTrainingCard";

let cachedSafeBrowsing: SafeBrowsingClient | null = null;
function getSafeBrowsingClient(): SafeBrowsingClient {
  if (!cachedSafeBrowsing) {
    cachedSafeBrowsing = new SafeBrowsingClient(getPrefixDb(), getAuditStore(), {
      apiKey: import.meta.env.VITE_SAFE_BROWSING_API_KEY,
    });
  }
  return cachedSafeBrowsing;
}

let cachedMlClient: MlClient | null = null;
function getMlClient(): MlClient {
  if (!cachedMlClient) {
    const modelUrl = chrome.runtime.getURL("models/phishing-classifier.onnx");
    cachedMlClient = new MlClient({
      predictor: new OnnxPredictor(modelUrl),
      modelVersion: "1.0.0",
    });
  }
  return cachedMlClient;
}

const activeExplanationRequests = new Map<string, AbortController>();

interface CachedTrainingCard {
  card: TrainingCard;
  mode: "local_llm" | "template";
}

const TRAINING_CARD_CACHE_LIMIT = 32;
// LRU cache of LLM-generated training cards keyed by the analysis's
// `urlHash`. We never need more than a few dozen — capped to keep memory flat
// over a long session. On hit we re-insert to refresh recency.
const llmTrainingCardCache = new Map<string, CachedTrainingCard>();

function getCachedTrainingCard(urlHash: string): CachedTrainingCard | null {
  const cached = llmTrainingCardCache.get(urlHash);
  if (!cached) return null;
  // Move to most-recent end.
  llmTrainingCardCache.delete(urlHash);
  llmTrainingCardCache.set(urlHash, cached);
  return cached;
}

function setCachedTrainingCard(urlHash: string, entry: CachedTrainingCard): void {
  llmTrainingCardCache.set(urlHash, entry);
  while (llmTrainingCardCache.size > TRAINING_CARD_CACHE_LIMIT) {
    const oldest = llmTrainingCardCache.keys().next().value;
    if (typeof oldest !== "string") break;
    llmTrainingCardCache.delete(oldest);
  }
}

export default defineBackground({
  type: "module",
  main() {
    console.info("[aegis] background service worker started");

    // Open the welcome page on a fresh install. We deliberately do NOT open
    // it on updates so we don't surprise existing users with a new tab.
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === "install") {
        chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
      }
    });

    registerMessageRouter(async (request): Promise<ExtensionResponse> => {
      return handleRequest(request);
    });
  },
});

async function handleRequest(request: ExtensionRequest): Promise<ExtensionResponse> {
  switch (request.type) {
    case "ANALYZE_URL": {
      const settings = await getSettingsStore().get();
      if (!settings.enabled) {
        const result = await disabledAnalysis({
          url: request.url,
          context: request.context,
        });
        return { type: "ANALYZE_URL_RESULT", requestId: request.requestId, result };
      }
      const cache = getVerdictCache();
      const result = await analyzeUrl({
        url: request.url,
        context: request.context,
        ...(settings.layers.threatIntel ? { threatIntel: getSafeBrowsingClient() } : {}),
        ...(settings.layers.ml ? { ml: getMlClient() } : {}),
        ...(settings.layers.headerAnalysis && typeof request.emailHeaderText === "string"
          ? { emailHeaderText: request.emailHeaderText }
          : {}),
      });
      await cache.put(result);
      if (result.verdict === "phishing") {
        // Best-effort; don't fail the analysis if the training store is unavailable.
        await getTrainingStore()
          .recordThreatSeen()
          .catch(() => undefined);
      }
      return { type: "ANALYZE_URL_RESULT", requestId: request.requestId, result };
    }
    case "GET_VERDICT": {
      const entry = await getVerdictCache().get(request.urlHash);
      return {
        type: "GET_VERDICT_RESULT",
        requestId: request.requestId,
        result: entry?.result,
      };
    }
    case "GET_RECENT_VERDICTS": {
      const entries = await getVerdictCache().recent(request.limit ?? 10);
      return {
        type: "GET_RECENT_VERDICTS_RESULT",
        requestId: request.requestId,
        results: entries.map((entry) => entry.result),
      };
    }
    case "GET_SETTINGS": {
      const settings = await getSettingsStore().get();
      return { type: "GET_SETTINGS_RESULT", requestId: request.requestId, settings };
    }
    case "UPDATE_SETTINGS": {
      const settings = await getSettingsStore().update(request.patch);
      return { type: "UPDATE_SETTINGS_RESULT", requestId: request.requestId, settings };
    }
    case "GET_AUDIT_LOG": {
      const records = await getAuditStore().recent(request.limit ?? 50);
      return { type: "GET_AUDIT_LOG_RESULT", requestId: request.requestId, records };
    }
    case "CLEAR_AUDIT_LOG": {
      await getAuditStore().clear();
      return { type: "CLEAR_AUDIT_LOG_RESULT", requestId: request.requestId };
    }
    case "CLEAR_VERDICT_CACHE": {
      await getVerdictCache().clear();
      // Training cards are derived from verdicts; clearing one without the
      // other would leave stale teaching material in the popup.
      llmTrainingCardCache.clear();
      return { type: "CLEAR_VERDICT_CACHE_RESULT", requestId: request.requestId };
    }
    case "GET_TRAINING_PROGRESS": {
      const progress = await getTrainingStore().get();
      return {
        type: "GET_TRAINING_PROGRESS_RESULT",
        requestId: request.requestId,
        progress,
      };
    }
    case "RECORD_TRAINING_ANSWER": {
      const progress = await getTrainingStore().recordAnswer(request.correct);
      return {
        type: "RECORD_TRAINING_ANSWER_RESULT",
        requestId: request.requestId,
        progress,
      };
    }
    case "RESET_TRAINING_PROGRESS": {
      const progress = await getTrainingStore().reset();
      return {
        type: "RESET_TRAINING_PROGRESS_RESULT",
        requestId: request.requestId,
        progress,
      };
    }
    case "RUN_PRIVACY_VERIFICATION": {
      const report = await runPrivacyVerification();
      return {
        type: "RUN_PRIVACY_VERIFICATION_RESULT",
        requestId: request.requestId,
        report,
      };
    }
    case "BUILD_LLM_TRAINING_CARD": {
      const cache = getVerdictCache();
      const entries = await cache.recent(50);
      const match = entries.find((e) => e.result.analysisId === request.analysisId);
      if (!match) {
        return makeErrorResponse(
          request.requestId,
          "INVALID_PAYLOAD",
          `No cached analysis found for analysisId ${request.analysisId}.`,
        );
      }
      const settings = await getSettingsStore().get();
      const cached = getCachedTrainingCard(match.result.urlHash);
      if (cached) {
        return {
          type: "BUILD_LLM_TRAINING_CARD_RESULT",
          requestId: request.requestId,
          card: cached.card,
          mode: cached.mode,
        };
      }
      if (!settings.layers.localLlm) {
        // No LLM available; return the deterministic template card and skip
        // caching so a future settings flip can produce the richer version.
        const card = buildTrainingCard(match.result);
        return {
          type: "BUILD_LLM_TRAINING_CARD_RESULT",
          requestId: request.requestId,
          card,
          mode: "template",
        };
      }
      const llmCard = await buildLlmTrainingCardWithFallback(match.result, {
        modelId: import.meta.env.VITE_WEBLLM_MODEL_ID,
      });
      if (llmCard) {
        setCachedTrainingCard(match.result.urlHash, { card: llmCard, mode: "local_llm" });
        return {
          type: "BUILD_LLM_TRAINING_CARD_RESULT",
          requestId: request.requestId,
          card: llmCard,
          mode: "local_llm",
        };
      }
      const templateCard = buildTrainingCard(match.result);
      return {
        type: "BUILD_LLM_TRAINING_CARD_RESULT",
        requestId: request.requestId,
        card: templateCard,
        mode: "template",
      };
    }
    case "INSPECT_VISUALLY": {
      const settings = await getSettingsStore().get();
      if (!settings.layers.visualInspection) {
        return makeErrorResponse(
          request.requestId,
          "INVALID_PAYLOAD",
          "Visual inspection layer is disabled in settings.",
        );
      }
      const cache = getVerdictCache();
      const entries = await cache.recent(50);
      const match = entries.find((e) => e.result.analysisId === request.analysisId);
      if (!match) {
        return makeErrorResponse(
          request.requestId,
          "INVALID_PAYLOAD",
          `No cached analysis found for analysisId ${request.analysisId}.`,
        );
      }
      const source = new OffscreenImageSource({
        store: getAuditStore(),
        consented: request.consented,
      });
      const visualClient = new VisualClient({ source });
      const parsed = parseUrl(match.result.urlDisplay);
      const visual = await visualClient.inspect(parsed);
      const updated = applyVisualResult(match.result, visual);
      await cache.put(updated);
      return {
        type: "INSPECT_VISUALLY_RESULT",
        requestId: request.requestId,
        result: updated,
      };
    }
    case "CANCEL_EXPLAIN_VERDICT": {
      const controller = activeExplanationRequests.get(request.targetRequestId);
      controller?.abort();
      return {
        type: "CANCEL_EXPLAIN_VERDICT_RESULT",
        requestId: request.requestId,
        cancelled: Boolean(controller),
      };
    }
    case "EXPLAIN_VERDICT": {
      const cache = getVerdictCache();
      const entries = await cache.recent(50);
      const match = entries.find((e) => e.result.analysisId === request.analysisId);
      if (!match) {
        return makeErrorResponse(
          request.requestId,
          "INVALID_PAYLOAD",
          `No cached analysis found for analysisId ${request.analysisId}.`,
        );
      }
      const settings = await getSettingsStore().get();
      if (request.mode === "template" || !settings.layers.localLlm) {
        const explanation = buildTemplateExplanation(match.result);
        return {
          type: "EXPLAIN_VERDICT_RESULT",
          requestId: request.requestId,
          explanation,
        };
      }

      const controller = new AbortController();
      activeExplanationRequests.set(request.requestId, controller);
      const explanation = await buildWebLlmExplanationWithFallback(match.result, {
        modelId: import.meta.env.VITE_WEBLLM_MODEL_ID,
        signal: controller.signal,
        onProgress: (progress) =>
          emitRuntimeResponse({
            type: "EXPLAIN_VERDICT_PROGRESS",
            requestId: request.requestId,
            ...progress,
          }),
        onToken: (text) =>
          emitRuntimeResponse({
            type: "EXPLAIN_VERDICT_CHUNK",
            requestId: request.requestId,
            text,
            done: false,
          }),
      }).finally(() => {
        activeExplanationRequests.delete(request.requestId);
      });
      return {
        type: "EXPLAIN_VERDICT_RESULT",
        requestId: request.requestId,
        explanation,
      };
    }
  }
}

function emitRuntimeResponse(message: ExtensionResponse): void {
  try {
    const maybePromise = chrome.runtime.sendMessage(message);
    if (maybePromise && typeof maybePromise.catch === "function") {
      maybePromise.catch(() => undefined);
    }
  } catch {
    // The popup may have closed; generation still falls back or completes normally.
  }
}

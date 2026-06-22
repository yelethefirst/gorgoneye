import type { InitProgressReport, MLCEngine } from "@mlc-ai/web-llm";
import type { AnalysisResult, ExplanationResult } from "../shared/verdict";
import { buildTemplateExplanation } from "./templateExplanation";
import { buildExplanationPrompt, type LlmPromptMessage } from "./promptBuilder";

// Selected by the AEG-4-1 hardware PoC on an M3 Pro / 18 GB / WebGPU laptop:
// TTFT 1077 ms, 35.6 tok/s — well inside the 5000 ms first-token budget.
// Override via VITE_WEBLLM_MODEL_ID if the demo hardware changes.
export const DEFAULT_WEBLLM_MODEL_ID = "SmolLM2-1.7B-Instruct-q4f32_1-MLC";
export const DEFAULT_FIRST_TOKEN_BUDGET_MS = 5000;
const DEFAULT_TOTAL_GENERATION_BUDGET_MS = 20000;

export interface WebLlmProgress {
  phase: "loading" | "generating" | "fallback";
  message: string;
  progress?: number;
}

interface ChatCompletionChunkLike {
  choices?: Array<{ delta?: { content?: string | null } }>;
}

interface ChatCompletionLike {
  choices?: Array<{ message?: { content?: string | null } }>;
}

export interface WebLlmEngineLike {
  chat: {
    completions: {
      create(request: {
        messages: LlmPromptMessage[];
        stream: true;
        temperature: number;
        max_tokens: number;
      }): Promise<AsyncIterable<ChatCompletionChunkLike> | ChatCompletionLike>;
    };
  };
  interruptGenerate?: () => void | Promise<void>;
}

export interface BuildWebLlmExplanationOptions {
  modelId?: string;
  now?: () => string;
  signal?: AbortSignal;
  firstTokenBudgetMs?: number;
  totalGenerationBudgetMs?: number;
  onProgress?: (progress: WebLlmProgress) => void;
  onToken?: (text: string) => void;
  engine?: WebLlmEngineLike;
}

let cachedModelId: string | null = null;
let cachedEngine: Promise<WebLlmEngineLike> | null = null;

export async function buildWebLlmExplanation(
  result: AnalysisResult,
  opts: BuildWebLlmExplanationOptions = {},
): Promise<ExplanationResult> {
  throwIfAborted(opts.signal);
  const modelId = opts.modelId || DEFAULT_WEBLLM_MODEL_ID;
  const engine = opts.engine ?? (await loadEngine(modelId, opts.onProgress));

  const prompt = buildExplanationPrompt(result);
  const abortGeneration = () => {
    void engine.interruptGenerate?.();
  };
  opts.signal?.addEventListener("abort", abortGeneration, { once: true });

  try {
    opts.onProgress?.({
      phase: "generating",
      message: "Generating local explanation.",
    });

    const generationStartedAt = nowMs();
    const streamOrResponse = await withTimeout(
      engine.chat.completions.create({
        messages: prompt,
        stream: true,
        temperature: 0.2,
        max_tokens: 220,
      }),
      opts.firstTokenBudgetMs ?? DEFAULT_FIRST_TOKEN_BUDGET_MS,
      () => {
        void engine.interruptGenerate?.();
      },
    );

    const rawText = isAsyncIterable(streamOrResponse)
      ? await collectStream(streamOrResponse, engine, opts, generationStartedAt)
      : (streamOrResponse.choices?.[0]?.message?.content ?? "");

    return coerceExplanation(rawText, result, opts.now);
  } finally {
    opts.signal?.removeEventListener("abort", abortGeneration);
  }
}

export async function buildWebLlmExplanationWithFallback(
  result: AnalysisResult,
  opts: BuildWebLlmExplanationOptions = {},
): Promise<ExplanationResult> {
  try {
    return await buildWebLlmExplanation(result, opts);
  } catch {
    opts.onProgress?.({
      phase: "fallback",
      message: "Local LLM unavailable; using template explanation.",
    });
    return buildTemplateExplanation(result, { now: opts.now });
  }
}

async function loadEngine(
  modelId: string,
  onProgress?: (progress: WebLlmProgress) => void,
): Promise<WebLlmEngineLike> {
  if (!cachedEngine || cachedModelId !== modelId) {
    cachedModelId = modelId;
    cachedEngine = import("@mlc-ai/web-llm")
      .then(({ CreateMLCEngine }) =>
        CreateMLCEngine(modelId, {
          initProgressCallback: (report: InitProgressReport) => {
            onProgress?.({
              phase: "loading",
              message: report.text,
              progress: report.progress,
            });
          },
        }),
      )
      .then((engine: MLCEngine) => engine as WebLlmEngineLike)
      .catch((err) => {
        cachedEngine = null;
        cachedModelId = null;
        throw err;
      });
  }
  return cachedEngine;
}

async function collectStream(
  stream: AsyncIterable<ChatCompletionChunkLike>,
  engine: WebLlmEngineLike,
  opts: BuildWebLlmExplanationOptions,
  generationStartedAt: number,
): Promise<string> {
  const iterator = stream[Symbol.asyncIterator]();
  const firstTokenBudgetMs = opts.firstTokenBudgetMs ?? DEFAULT_FIRST_TOKEN_BUDGET_MS;
  const totalBudgetMs = opts.totalGenerationBudgetMs ?? DEFAULT_TOTAL_GENERATION_BUDGET_MS;
  let firstTokenSeen = false;
  let text = "";

  while (true) {
    throwIfAborted(opts.signal);
    const elapsed = nowMs() - generationStartedAt;
    const remainingTotal = Math.max(1, totalBudgetMs - elapsed);
    const remainingFirstToken = Math.max(1, firstTokenBudgetMs - elapsed);
    const timeoutMs = firstTokenSeen
      ? remainingTotal
      : Math.min(remainingFirstToken, remainingTotal);
    const next = await withTimeout(iterator.next(), timeoutMs, () => {
      void engine.interruptGenerate?.();
    });
    if (next.done) break;
    const delta = next.value.choices?.[0]?.delta?.content ?? "";
    if (!delta) continue;
    firstTokenSeen = true;
    text += delta;
    opts.onToken?.(delta);
  }

  return text;
}

function coerceExplanation(
  rawText: string,
  result: AnalysisResult,
  now?: () => string,
): ExplanationResult {
  const fallback = buildTemplateExplanation(result, { now });
  const cleaned = stripCodeFence(rawText).trim();
  if (!cleaned) return fallback;

  try {
    const parsed = JSON.parse(cleaned) as { text?: unknown; guidance?: unknown };
    const text = typeof parsed.text === "string" ? parsed.text.trim() : "";
    const guidance = Array.isArray(parsed.guidance)
      ? parsed.guidance
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 3)
      : [];
    if (text) {
      return {
        text,
        guidance: guidance.length > 0 ? guidance : fallback.guidance,
        mode: "local_llm",
        generatedAt: (now ?? (() => new Date().toISOString()))(),
      };
    }
  } catch {
    // Fall through to plain-text salvage.
  }

  return {
    text: cleaned,
    guidance: fallback.guidance,
    mode: "local_llm",
    generatedAt: (now ?? (() => new Date().toISOString()))(),
  };
}

function stripCodeFence(value: string): string {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
}

function isAsyncIterable(
  value: AsyncIterable<ChatCompletionChunkLike> | ChatCompletionLike,
): value is AsyncIterable<ChatCompletionChunkLike> {
  return (
    typeof (value as AsyncIterable<ChatCompletionChunkLike>)[Symbol.asyncIterator] === "function"
  );
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => void,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          onTimeout();
          reject(new Error(`Local LLM timed out after ${timeoutMs} ms.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  const err = new Error("Local LLM explanation was cancelled.");
  err.name = "AbortError";
  throw err;
}

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

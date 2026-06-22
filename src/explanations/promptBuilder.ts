import type { AnalysisResult } from "../shared/verdict";

export interface LlmPromptMessage {
  role: "system" | "user";
  content: string;
}

interface PromptSignal {
  layer: string;
  severity: string;
  title: string;
  detail: string;
}

interface PromptLayer {
  layer: string;
  status: string;
  score?: number;
  matched?: boolean;
  probability?: number | null;
}

export interface ExplanationPromptPayload {
  verdict: AnalysisResult["verdict"];
  confidence: number;
  firedSignals: PromptSignal[];
  layers: PromptLayer[];
  unavailableLayers: Array<{ layer: string; reason: string }>;
  privacy: {
    hashPrefixSentToThreatIntel: boolean;
    targetOriginContacted: boolean;
  };
}

const SYSTEM_PROMPT = [
  "You explain Gorgon Eye phishing verdicts to non-technical users.",
  "Use only the JSON evidence provided by the user message.",
  "Do not invent evidence, brands, page content, sender identity, email body, screenshots, or headers.",
  'Return JSON only in this shape: {"text":"2-3 sentences","guidance":["action 1","action 2"]}.',
  "Keep guidance short, concrete, and based on the verdict.",
].join(" ");

export function buildExplanationPrompt(result: AnalysisResult): LlmPromptMessage[] {
  const payload = buildExplanationPromptPayload(result);
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Explain this phishing-analysis result:\n${JSON.stringify(payload, null, 2)}`,
    },
  ];
}

export function buildExplanationPromptPayload(result: AnalysisResult): ExplanationPromptPayload {
  return {
    verdict: result.verdict,
    confidence: round(result.confidence),
    firedSignals: result.firedSignals.slice(0, 6).map((signal) => ({
      layer: signal.layer,
      severity: signal.severity,
      title: signal.title,
      detail: signal.detail,
    })),
    layers: Object.entries(result.layers).map(([layer, value]) => {
      if (!value) return { layer, status: "not_available" };
      const status =
        "status" in value && typeof value.status === "string" ? value.status : "unknown";
      const out: PromptLayer = { layer, status };
      if ("score" in value && typeof value.score === "number") out.score = round(value.score);
      if ("matched" in value && typeof value.matched === "boolean") {
        out.matched = value.matched;
      }
      if ("probability" in value) out.probability = value.probability;
      return out;
    }),
    unavailableLayers: result.unavailableLayers.map((entry) => ({
      layer: entry.layer,
      reason: entry.reason,
    })),
    privacy: {
      hashPrefixSentToThreatIntel: result.privacy.hashPrefixSentToThreatIntel,
      targetOriginContacted: result.privacy.targetOriginContacted,
    },
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

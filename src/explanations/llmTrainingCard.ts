import type { AnalysisResult } from "../shared/verdict";
import type { TrainingCard, TrainingOption } from "../ui/popup/buildTrainingCard";
import { buildExplanationPromptPayload } from "./promptBuilder";
import type { LlmPromptMessage } from "./promptBuilder";
import type { WebLlmEngineLike } from "./webllmExplanation";
import {
  DEFAULT_WEBLLM_MODEL_ID,
  DEFAULT_FIRST_TOKEN_BUDGET_MS,
} from "./webllmExplanation";

const DEFAULT_TOTAL_GENERATION_BUDGET_MS = 25000;

export interface BuildLlmTrainingCardOptions {
  modelId?: string;
  signal?: AbortSignal;
  firstTokenBudgetMs?: number;
  totalGenerationBudgetMs?: number;
  /** Test seam: when provided, the lazy MLCEngine load is skipped. */
  engine?: WebLlmEngineLike;
}

/**
 * Same lazy-load semantics as `buildWebLlmExplanation`: the WebLLM module is
 * imported only when the function is called, and the resolved engine is
 * cached at module scope keyed by model id.
 */
let cachedModelId: string | null = null;
let cachedEngine: Promise<WebLlmEngineLike> | null = null;

/**
 * Builds the prompt the LLM sees when asked to produce a training card.
 * The prompt is structured-data only — no email body, no raw URL, no
 * sender / recipient.
 */
export function buildLlmTrainingCardPrompt(result: AnalysisResult): LlmPromptMessage[] {
  const payload = buildExplanationPromptPayload(result);
  const systemPrompt = [
    "You write one-question micro-training cards that teach non-technical users to spot phishing URLs.",
    "Use only the JSON evidence provided by the user message.",
    "Do not invent evidence, brands, page content, sender identity, email body, screenshots, or headers.",
    "Pick the single most teachable fired signal and write the card around it.",
    "Return JSON only in this shape: " +
      '{"giveaway":"one-sentence hint","question":"one short question",' +
      '"options":[{"label":"...","correct":true},{"label":"...","correct":false},{"label":"...","correct":false}],' +
      '"explanation":"1-2 sentences explaining why the correct answer is correct"}',
    "Exactly one option must have correct=true. Provide 3 options total.",
    "Keep every string under 220 characters.",
  ].join(" ");
  return [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Generate a training card for this phishing-analysis result:\n${JSON.stringify(payload, null, 2)}`,
    },
  ];
}

/**
 * Generates an LLM-authored training card. The card is validated against the
 * `TrainingCard` shape; if the model returns malformed JSON or violates the
 * "exactly one correct option" invariant, the function throws so the caller
 * can fall back.
 */
export async function buildLlmTrainingCard(
  result: AnalysisResult,
  opts: BuildLlmTrainingCardOptions = {},
): Promise<TrainingCard> {
  throwIfAborted(opts.signal);
  const modelId = opts.modelId || DEFAULT_WEBLLM_MODEL_ID;
  const engine = opts.engine ?? (await loadEngine(modelId));

  const prompt = buildLlmTrainingCardPrompt(result);
  const abortGeneration = () => {
    void engine.interruptGenerate?.();
  };
  opts.signal?.addEventListener("abort", abortGeneration, { once: true });

  const generationStartedAt = nowMs();
  try {
    const streamOrResponse = await withTimeout(
      engine.chat.completions.create({
        messages: prompt,
        stream: true,
        temperature: 0.3,
        max_tokens: 320,
      }),
      opts.firstTokenBudgetMs ?? DEFAULT_FIRST_TOKEN_BUDGET_MS,
      () => {
        void engine.interruptGenerate?.();
      },
    );

    const rawText = isAsyncIterable(streamOrResponse)
      ? await collectStream(streamOrResponse, engine, opts, generationStartedAt)
      : (streamOrResponse.choices?.[0]?.message?.content ?? "");

    return coerceTrainingCard(rawText, result);
  } finally {
    opts.signal?.removeEventListener("abort", abortGeneration);
  }
}

/**
 * Returns the LLM-authored card, or `null` on any failure (abort, timeout,
 * invalid JSON, engine load error). The caller is expected to substitute the
 * deterministic template card in the null case — keeping that decision in
 * the caller lets the popup distinguish between "LLM produced a card" and
 * "LLM unavailable, here's the static teaching material".
 */
export async function buildLlmTrainingCardWithFallback(
  result: AnalysisResult,
  opts: BuildLlmTrainingCardOptions = {},
): Promise<TrainingCard | null> {
  try {
    return await buildLlmTrainingCard(result, opts);
  } catch {
    return null;
  }
}

async function loadEngine(modelId: string): Promise<WebLlmEngineLike> {
  if (!cachedEngine || cachedModelId !== modelId) {
    cachedModelId = modelId;
    cachedEngine = import("@mlc-ai/web-llm")
      .then(({ CreateMLCEngine }) => CreateMLCEngine(modelId))
      .then((engine) => engine as unknown as WebLlmEngineLike)
      .catch((err) => {
        cachedEngine = null;
        cachedModelId = null;
        throw err;
      });
  }
  return cachedEngine;
}

interface ChatCompletionChunkLike {
  choices?: Array<{ delta?: { content?: string | null } }>;
}

interface ChatCompletionLike {
  choices?: Array<{ message?: { content?: string | null } }>;
}

async function collectStream(
  stream: AsyncIterable<ChatCompletionChunkLike>,
  engine: WebLlmEngineLike,
  opts: BuildLlmTrainingCardOptions,
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
  }

  return text;
}

interface ParsedTrainingCardPayload {
  giveaway?: unknown;
  question?: unknown;
  options?: unknown;
  explanation?: unknown;
}

interface ParsedOption {
  label?: unknown;
  correct?: unknown;
}

const MAX_FIELD_LENGTH = 280;

function coerceTrainingCard(rawText: string, result: AnalysisResult): TrainingCard {
  const cleaned = stripCodeFence(rawText).trim();
  if (!cleaned) throw new Error("Local LLM returned empty content for the training card.");
  const parsed = JSON.parse(cleaned) as ParsedTrainingCardPayload;
  const giveaway = clipString(parsed.giveaway);
  const question = clipString(parsed.question);
  const explanation = clipString(parsed.explanation);
  if (!giveaway || !question || !explanation) {
    throw new Error("Local LLM training card is missing one of: giveaway, question, explanation.");
  }
  if (!Array.isArray(parsed.options) || parsed.options.length < 3 || parsed.options.length > 4) {
    throw new Error("Local LLM training card must have 3 or 4 options.");
  }
  const options: TrainingOption[] = parsed.options.map((rawOption) => {
    const option = rawOption as ParsedOption;
    const label = clipString(option.label);
    if (!label) throw new Error("Local LLM training card option missing label.");
    return { label, correct: option.correct === true };
  });
  const correctCount = options.filter((o) => o.correct).length;
  if (correctCount !== 1) {
    throw new Error("Local LLM training card must have exactly one correct option.");
  }
  const sourceRuleId = result.firedSignals[0]?.id ?? "phishing_generic";
  return {
    giveaway,
    question,
    options,
    explanation,
    sourceRuleId,
  };
}

function clipString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_FIELD_LENGTH);
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
          reject(new Error(`Local LLM training card timed out after ${timeoutMs} ms.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  const err = new Error("Local LLM training card was cancelled.");
  err.name = "AbortError";
  throw err;
}

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

import type { ParsedUrl } from "../shared/parsedUrl";
import type { RuleSignal, RulesResult } from "../shared/verdict";
import type { Rule } from "./types";
import { DEFAULT_RULES } from "./defaultRules";

export interface RulesEngineOptions {
  rules?: readonly Rule[];
  now?: () => number;
}

function highResolutionNow(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

// Noisy-OR aggregation. Treats each fired signal's score as an independent
// probability of phishing, so multiple weak signals accumulate but the total
// remains bounded in [0, 1].
function aggregate(signals: RuleSignal[]): number {
  let pSafe = 1;
  for (const s of signals) {
    if (!s.fired) continue;
    const clamped = Math.min(1, Math.max(0, s.score));
    pSafe *= 1 - clamped;
  }
  return Number((1 - pSafe).toFixed(4));
}

export class RulesEngine {
  private readonly rules: readonly Rule[];
  private readonly now: () => number;

  constructor(opts: RulesEngineOptions = {}) {
    this.rules = opts.rules ?? DEFAULT_RULES;
    this.now = opts.now ?? highResolutionNow;
  }

  analyze(parsed: ParsedUrl): RulesResult {
    const start = this.now();
    const signals: RuleSignal[] = [];
    let firstError: string | undefined;

    for (const rule of this.rules) {
      try {
        signals.push(rule.evaluate(parsed));
      } catch (err) {
        firstError ??= `${rule.id}: ${err instanceof Error ? err.message : String(err)}`;
        signals.push({
          id: rule.id,
          layer: "rules",
          name: rule.name,
          fired: false,
          severity: "info",
          weight: rule.defaultWeight,
          score: 0,
          description: `Rule "${rule.id}" failed to evaluate; treated as no-signal.`,
          evidence: {},
        });
      }
    }

    const durationMs = Math.max(0, this.now() - start);
    const score = aggregate(signals);

    return {
      layer: "rules",
      status: firstError ? "error" : "complete",
      score,
      durationMs,
      signals,
      ...(firstError ? { error: firstError } : {}),
    };
  }
}

export const defaultRulesEngine = new RulesEngine();

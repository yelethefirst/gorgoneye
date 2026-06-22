import type { LayerId, Verdict } from "../shared/verdict";

/** Per-layer weight when fusing layer outputs into a single verdict score. */
export const LAYER_WEIGHTS: Record<LayerId, number> = {
  rules: 1, // rules.score is already a noisy-OR of its own signals
  ml: 1, // ml.probability is treated as a probability in [0, 1]
  threat_intel: 0.9, // deterministic signal weight per detection-pipeline doc
  visual: 0.85,
  headers: 0.4,
  explanation: 0, // post-verdict layer; never contributes to score
};

export interface LayerContribution {
  layer: LayerId;
  /** Probability-like value in [0, 1]; clamped if out of range. */
  score: number;
}

/**
 * Combines independent layer contributions via noisy-OR:
 *   score = 1 - ∏(1 - clamp(contribution.score * weight))
 * The result is bounded in [0, 1], order-independent, and accumulates
 * additively when multiple weak signals agree.
 */
export function fuseLayers(contributions: LayerContribution[]): number {
  let pSafe = 1;
  for (const c of contributions) {
    const weight = LAYER_WEIGHTS[c.layer] ?? 1;
    const clamped = Math.min(1, Math.max(0, c.score)) * weight;
    pSafe *= 1 - Math.min(1, Math.max(0, clamped));
  }
  return Number((1 - pSafe).toFixed(4));
}

// Thresholds mirror docs/architecture/detection-pipeline.md.
export const THRESHOLD_SUSPICIOUS = 0.3;
export const THRESHOLD_PHISHING = 0.75;

export function verdictFromScore(score: number): Verdict {
  if (score >= THRESHOLD_PHISHING) return "phishing";
  if (score >= THRESHOLD_SUSPICIOUS) return "suspicious";
  return "safe";
}

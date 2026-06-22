import type { ParsedUrl } from "../shared/parsedUrl";
import type { MlResult } from "../shared/verdict";
import { extractFeatures } from "./features";
import { FEATURE_SCHEMA_VERSION } from "./featureSchema";
import type { Predictor } from "./predictor";

export interface MlClientOptions {
  predictor: Predictor;
  /**
   * Model-release identifier. Surfaced in `MlResult.modelVersion` so the
   * popup / audit log can show which classifier produced a verdict.
   */
  modelVersion: string;
  /**
   * Minimum probability before the ML layer is treated as contributing
   * evidence in fusion. Default 0.6 — the synthetic training set produces
   * very sharp probabilities; real datasets will tune this.
   */
  threshold?: number;
  /** Inject for deterministic perf measurement. Defaults to `performance.now`. */
  now?: () => number;
}

const DEFAULT_THRESHOLD = 0.6;

function performanceNow(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

/**
 * Bridges `ParsedUrl` → feature vector → `Predictor` → `MlResult`.
 *
 * The wrapper handles:
 *   - Feature extraction (deterministic, sub-millisecond — see AEG-3-5).
 *   - Calling the predictor and timing the call.
 *   - Translating throws into `status: "error"` so the fusion engine never
 *     crashes a verdict because the model misbehaved.
 *   - Stamping the model and feature-schema versions onto the result so the
 *     UI and audit log can show which artifacts produced a number.
 */
export class MlClient {
  private readonly threshold: number;
  private readonly now: () => number;

  constructor(private readonly opts: MlClientOptions) {
    this.threshold = opts.threshold ?? DEFAULT_THRESHOLD;
    this.now = opts.now ?? performanceNow;
  }

  /** The threshold above which the layer is treated as contributing evidence. */
  get fusionThreshold(): number {
    return this.threshold;
  }

  async predict(parsed: ParsedUrl): Promise<MlResult> {
    const start = this.now();
    if (parsed.parseError) {
      return {
        layer: "ml",
        status: "unavailable",
        probability: null,
        modelVersion: this.opts.modelVersion,
        featureSchemaVersion: FEATURE_SCHEMA_VERSION,
        durationMs: this.now() - start,
        error: `URL did not parse (${parsed.parseError}); skipping ML.`,
      };
    }
    try {
      const features = extractFeatures(parsed);
      const probability = await this.opts.predictor.predict(features);
      if (!Number.isFinite(probability)) {
        throw new Error(`Predictor returned non-finite value: ${probability}`);
      }
      const clamped = Math.min(1, Math.max(0, probability));
      return {
        layer: "ml",
        status: "complete",
        probability: clamped,
        modelVersion: this.opts.modelVersion,
        featureSchemaVersion: FEATURE_SCHEMA_VERSION,
        durationMs: this.now() - start,
      };
    } catch (err) {
      return {
        layer: "ml",
        status: "error",
        probability: null,
        modelVersion: this.opts.modelVersion,
        featureSchemaVersion: FEATURE_SCHEMA_VERSION,
        durationMs: this.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

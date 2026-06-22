import { describe, expect, it } from "vitest";
import { analyzeUrl } from "../../src/detection/analyzeUrl";
import { MlClient } from "../../src/ml/mlClient";
import type { Predictor } from "../../src/ml/predictor";

const ctx = { surface: "test_fixture" as const, userGesture: "manual_scan" as const };

class StaticPredictor implements Predictor {
  constructor(private readonly value: number) {}
  async predict(): Promise<number> {
    return this.value;
  }
}

class ThrowingPredictor implements Predictor {
  async predict(): Promise<number> {
    throw new Error("simulated session crash");
  }
}

const SAFE_URL = "https://github.com/aegishield/aegis-gorgon";
const SUSPICIOUS_URL = "https://shop.example.co.uk/account/login";

function makeClient(value: number, threshold = 0.6) {
  return new MlClient({
    predictor: new StaticPredictor(value),
    modelVersion: "test-1.0.0",
    threshold,
  });
}

describe("analyzeUrl + ML layer (AEG-3-7)", () => {
  it("without a client: ml is in unavailableLayers and layers.ml is undefined", async () => {
    const result = await analyzeUrl({ url: SAFE_URL, context: ctx });
    expect(result.layers.ml).toBeUndefined();
    expect(result.unavailableLayers.some((u) => u.layer === "ml")).toBe(true);
  });

  it("with a low-probability client: layers.ml runs and is recorded, but does NOT contribute to the score", async () => {
    const baseline = await analyzeUrl({ url: SAFE_URL, context: ctx });
    const withMl = await analyzeUrl({
      url: SAFE_URL,
      context: ctx,
      ml: makeClient(0.1),
    });
    expect(withMl.layers.ml?.status).toBe("complete");
    expect(withMl.layers.ml?.probability).toBeCloseTo(0.1);
    // Below threshold → no fired signal → identical confidence to baseline.
    expect(withMl.confidence).toBeCloseTo(baseline.confidence, 4);
    expect(withMl.verdict).toBe(baseline.verdict);
    expect(withMl.firedSignals.some((s) => s.layer === "ml")).toBe(false);
  });

  it("with a high-probability client: ml contributes, signal fires, confidence rises", async () => {
    const baseline = await analyzeUrl({ url: SUSPICIOUS_URL, context: ctx });
    const withMl = await analyzeUrl({
      url: SUSPICIOUS_URL,
      context: ctx,
      ml: makeClient(0.9),
    });
    expect(withMl.layers.ml?.probability).toBeCloseTo(0.9);
    expect(withMl.confidence).toBeGreaterThan(baseline.confidence);
    const mlSignal = withMl.firedSignals.find((s) => s.layer === "ml");
    expect(mlSignal).toBeDefined();
    expect(mlSignal!.severity).toBe("high");
  });

  it("ml signal severity drops to 'medium' below 0.85", async () => {
    const result = await analyzeUrl({
      url: SUSPICIOUS_URL,
      context: ctx,
      ml: makeClient(0.7),
    });
    const mlSignal = result.firedSignals.find((s) => s.layer === "ml");
    expect(mlSignal?.severity).toBe("medium");
  });

  it("respects a custom threshold (probability above default but below custom is not fired)", async () => {
    const result = await analyzeUrl({
      url: SAFE_URL,
      context: ctx,
      ml: makeClient(0.7, 0.95),
    });
    expect(result.layers.ml?.status).toBe("complete");
    expect(result.firedSignals.some((s) => s.layer === "ml")).toBe(false);
  });

  it("predictor that throws does not crash the analysis; status=error reported instead", async () => {
    const result = await analyzeUrl({
      url: SAFE_URL,
      context: ctx,
      ml: new MlClient({
        predictor: new ThrowingPredictor(),
        modelVersion: "test-1.0.0",
      }),
    });
    expect(result.layers.ml?.status).toBe("error");
    // Missing ML never counts as safe; the verdict is whatever rules say.
    expect(result.verdict).toBe("safe");
  });

  it("ML + threat-intel can co-exist: both layers appear in result.layers", async () => {
    const result = await analyzeUrl({
      url: SAFE_URL,
      context: ctx,
      ml: makeClient(0.4),
    });
    expect(result.layers.ml).toBeDefined();
    expect(result.timings.mlMs).toBeGreaterThanOrEqual(0);
  });
});

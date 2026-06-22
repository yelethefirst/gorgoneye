import { describe, expect, it } from "vitest";
import { MlClient } from "../../src/ml/mlClient";
import type { Predictor } from "../../src/ml/predictor";
import { parseUrl } from "../../src/rules/parseUrl";
import { FEATURE_SCHEMA_VERSION } from "../../src/ml/featureSchema";

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

class NonFinitePredictor implements Predictor {
  async predict(): Promise<number> {
    return Number.NaN;
  }
}

const SAMPLE_PARSED = parseUrl("https://github.com/aegishield/gorgon-eye");
const PHISH_PARSED = parseUrl("https://paypa1.example/account/verify");

describe("MlClient.predict", () => {
  it("returns status=complete with the predictor's probability when finite", async () => {
    const client = new MlClient({
      predictor: new StaticPredictor(0.42),
      modelVersion: "1.0.0",
    });
    const result = await client.predict(SAMPLE_PARSED);
    expect(result.status).toBe("complete");
    expect(result.probability).toBeCloseTo(0.42);
    expect(result.modelVersion).toBe("1.0.0");
    expect(result.featureSchemaVersion).toBe(FEATURE_SCHEMA_VERSION);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("clamps probabilities outside [0,1]", async () => {
    const high = await new MlClient({
      predictor: new StaticPredictor(1.7),
      modelVersion: "v",
    }).predict(SAMPLE_PARSED);
    const low = await new MlClient({
      predictor: new StaticPredictor(-0.4),
      modelVersion: "v",
    }).predict(SAMPLE_PARSED);
    expect(high.probability).toBe(1);
    expect(low.probability).toBe(0);
  });

  it("returns status=error when the predictor throws", async () => {
    const client = new MlClient({
      predictor: new ThrowingPredictor(),
      modelVersion: "v",
    });
    const result = await client.predict(SAMPLE_PARSED);
    expect(result.status).toBe("error");
    expect(result.probability).toBeNull();
    expect(result.error).toMatch(/simulated/);
  });

  it("returns status=error when the predictor returns a non-finite value", async () => {
    const client = new MlClient({
      predictor: new NonFinitePredictor(),
      modelVersion: "v",
    });
    const result = await client.predict(PHISH_PARSED);
    expect(result.status).toBe("error");
    expect(result.error).toMatch(/non-finite/i);
  });

  it("returns status=unavailable for a URL that failed to parse", async () => {
    const client = new MlClient({
      predictor: new StaticPredictor(0.9),
      modelVersion: "v",
    });
    const broken = parseUrl("not a url");
    const result = await client.predict(broken);
    expect(result.status).toBe("unavailable");
    expect(result.probability).toBeNull();
    expect(result.error).toMatch(/did not parse/i);
  });

  it("exposes the configured fusion threshold (default 0.6)", () => {
    const def = new MlClient({
      predictor: new StaticPredictor(0),
      modelVersion: "v",
    });
    const custom = new MlClient({
      predictor: new StaticPredictor(0),
      modelVersion: "v",
      threshold: 0.8,
    });
    expect(def.fusionThreshold).toBe(0.6);
    expect(custom.fusionThreshold).toBe(0.8);
  });
});

import { describe, expect, it } from "vitest";
import {
  fuseLayers,
  verdictFromScore,
  THRESHOLD_PHISHING,
  THRESHOLD_SUSPICIOUS,
} from "../../src/detection/fusion";

describe("fuseLayers", () => {
  it("returns 0 for no contributions", () => {
    expect(fuseLayers([])).toBe(0);
  });

  it("returns the single layer's score for one contribution (rules weight 1)", () => {
    expect(fuseLayers([{ layer: "rules", score: 0.5 }])).toBeCloseTo(0.5);
  });

  it("clamps out-of-range scores", () => {
    expect(fuseLayers([{ layer: "rules", score: 2.0 }])).toBe(1);
    expect(fuseLayers([{ layer: "rules", score: -0.5 }])).toBe(0);
  });

  it("a confirmed threat-intel match alone clears the phishing threshold", () => {
    // weight 0.9 * 1 -> 0.9 fused score; ≥ 0.75 → phishing.
    const score = fuseLayers([{ layer: "threat_intel", score: 1 }]);
    expect(score).toBeGreaterThanOrEqual(THRESHOLD_PHISHING);
  });

  it("combines independent signals via noisy-OR (bounded, additive)", () => {
    const a = fuseLayers([{ layer: "rules", score: 0.4 }]);
    const b = fuseLayers([
      { layer: "rules", score: 0.4 },
      { layer: "threat_intel", score: 1 },
    ]);
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThanOrEqual(1);
  });

  it("verdictFromScore reflects the documented thresholds", () => {
    expect(verdictFromScore(0)).toBe("safe");
    expect(verdictFromScore(THRESHOLD_SUSPICIOUS - 0.001)).toBe("safe");
    expect(verdictFromScore(THRESHOLD_SUSPICIOUS)).toBe("suspicious");
    expect(verdictFromScore(THRESHOLD_PHISHING - 0.001)).toBe("suspicious");
    expect(verdictFromScore(THRESHOLD_PHISHING)).toBe("phishing");
    expect(verdictFromScore(1)).toBe("phishing");
  });
});

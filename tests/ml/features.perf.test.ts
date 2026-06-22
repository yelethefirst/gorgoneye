import { describe, expect, it } from "vitest";
import { extractFeatures } from "../../src/ml/features";
import { parseUrl } from "../../src/rules/parseUrl";
import { computeStats } from "../../src/detection/perf";
import { SNAPSHOT_URLS } from "./snapshotUrls";

describe("extractFeatures perf budget (AEG-3-5)", () => {
  it("runs in well under 5 ms per URL across the parity corpus", () => {
    const parsed = SNAPSHOT_URLS.map((u) => parseUrl(u));
    // Warm-up
    extractFeatures(parsed[0]!);
    const iterations = 500;
    const durations = new Array<number>(iterations);
    for (let i = 0; i < iterations; i += 1) {
      const p = parsed[i % parsed.length]!;
      const start = performance.now();
      extractFeatures(p);
      durations[i] = performance.now() - start;
    }
    const stats = computeStats(durations);
    console.info(
      `[perf] extractFeatures over ${iterations} iterations — ` +
        `mean=${stats.mean.toFixed(3)}ms P50=${stats.p50.toFixed(3)}ms ` +
        `P95=${stats.p95.toFixed(3)}ms max=${stats.max.toFixed(3)}ms`,
    );
    expect(stats.p95).toBeLessThan(5);
  });
});

import { describe, expect, it } from "vitest";
import { analyzeUrl } from "../../src/detection/analyzeUrl";
import { DEMO_FIXTURES } from "../../src/fixtures/demoFixtures";

describe("DEMO_FIXTURES (AEG-11-4)", () => {
  it("contains at least 20 fixtures spanning all three verdict buckets", () => {
    expect(DEMO_FIXTURES.length).toBeGreaterThanOrEqual(20);
    const buckets = new Set(DEMO_FIXTURES.map((f) => f.expectedVerdict));
    expect(buckets.has("safe")).toBe(true);
    expect(buckets.has("suspicious")).toBe(true);
    expect(buckets.has("phishing")).toBe(true);
  });

  it("has no duplicate URLs", () => {
    const urls = DEMO_FIXTURES.map((f) => f.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it.each(DEMO_FIXTURES)(
    "$expectedVerdict — $description",
    async ({ url, expectedVerdict, expectedRules }) => {
      const result = await analyzeUrl({
        url,
        context: { surface: "test_fixture", userGesture: "manual_scan" },
      });
      expect(result.verdict, `Verdict mismatch for ${url}`).toBe(expectedVerdict);
      const firedIds = result.layers.rules.signals
        .filter((s) => s.fired)
        .map((s) => s.id);
      for (const ruleId of expectedRules) {
        expect(firedIds, `Expected ${ruleId} to fire for ${url}`).toContain(ruleId);
      }
    },
  );
});

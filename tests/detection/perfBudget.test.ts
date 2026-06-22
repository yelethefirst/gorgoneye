import { describe, expect, it } from "vitest";
import { analyzeUrl } from "../../src/detection/analyzeUrl";
import { defaultRulesEngine } from "../../src/rules/engine";
import { parseUrl } from "../../src/rules/parseUrl";
import { measureAsync, computeStats } from "../../src/detection/perf";
import { DEMO_FIXTURES } from "../../src/fixtures/demoFixtures";

/**
 * Build a corpus of at least 100 distinct URLs by combining the curated demo
 * fixtures with synthetic variations. The synthetic block is deterministic so
 * the same sample distribution is measured on every run.
 */
function buildCorpus(): string[] {
  const out = new Set<string>(DEMO_FIXTURES.map((f) => f.url));
  const hosts = [
    "example.com",
    "shop.example.co.uk",
    "news.example.org",
    "api.example.dev",
    "store.example.io",
    "blog.example.net",
    "docs.example.com",
    "a.b.c.example.com",
    "promo.top",
    "invoice.zip",
  ];
  const paths = [
    "/",
    "/about",
    "/articles/2024/news",
    "/products/abc-123",
    "/wiki/Phishing",
    "/login",
    "/account/verify",
    "/r?to=https://attacker.example/login",
    "/recover/password?token=ABCDEF1234",
    "/blog/article-2024",
  ];
  for (const host of hosts) {
    for (const path of paths) {
      out.add(`https://${host}${path}`);
      if (out.size >= 120) break;
    }
    if (out.size >= 120) break;
  }
  return Array.from(out);
}

const CORPUS = buildCorpus();

describe("performance budget (AEG-11-3)", () => {
  it("corpus has at least 100 distinct URLs", () => {
    expect(CORPUS.length).toBeGreaterThanOrEqual(100);
    expect(new Set(CORPUS).size).toBe(CORPUS.length);
  });

  it("analyzeUrl meets the product budget (P50 < 100 ms, P95 < 300 ms)", async () => {
    const { stats } = await measureAsync(CORPUS, (url) =>
      analyzeUrl({
        url,
        context: { surface: "test_fixture", userGesture: "manual_scan" },
      }),
    );

    console.info(
      `[perf] analyzeUrl over ${stats.sampleCount} URLs — ` +
        `mean=${stats.mean.toFixed(2)}ms P50=${stats.p50.toFixed(2)}ms ` +
        `P90=${stats.p90.toFixed(2)}ms P95=${stats.p95.toFixed(2)}ms ` +
        `max=${stats.max.toFixed(2)}ms`,
    );

    expect(stats.p50).toBeLessThan(100);
    expect(stats.p95).toBeLessThan(300);
  });

  it("rules engine alone meets the per-layer budget (P95 < 10 ms)", () => {
    const parsedCorpus = CORPUS.map((u) => parseUrl(u));
    // Warm-up
    defaultRulesEngine.analyze(parsedCorpus[0]!);
    const durations = parsedCorpus.map((parsed) => {
      const start = performance.now();
      defaultRulesEngine.analyze(parsed);
      return performance.now() - start;
    });
    const stats = computeStats(durations);

    console.info(
      `[perf] rules engine over ${stats.sampleCount} URLs — ` +
        `mean=${stats.mean.toFixed(2)}ms P50=${stats.p50.toFixed(2)}ms ` +
        `P95=${stats.p95.toFixed(2)}ms max=${stats.max.toFixed(2)}ms`,
    );

    expect(stats.p95).toBeLessThan(10);
  });
});

describe("computeStats", () => {
  it("computes percentiles using the nearest-rank method", () => {
    const stats = computeStats([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(stats.sampleCount).toBe(10);
    expect(stats.p50).toBe(50);
    expect(stats.p90).toBe(90);
    expect(stats.p95).toBe(100);
    expect(stats.max).toBe(100);
    expect(stats.mean).toBe(55);
  });

  it("throws on empty input", () => {
    expect(() => computeStats([])).toThrow(/non-empty/);
  });

  it("handles a single sample", () => {
    expect(computeStats([42])).toMatchObject({
      sampleCount: 1,
      mean: 42,
      p50: 42,
      p95: 42,
      max: 42,
    });
  });
});

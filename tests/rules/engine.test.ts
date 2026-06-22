import { describe, expect, it } from "vitest";
import { parseUrl } from "../../src/rules/parseUrl";
import { RulesEngine, defaultRulesEngine } from "../../src/rules/engine";
import { DEFAULT_RULES } from "../../src/rules/defaultRules";

function analyze(rawUrl: string) {
  return defaultRulesEngine.analyze(parseUrl(rawUrl));
}

describe("RulesEngine", () => {
  it("returns one signal per registered rule in deterministic order", () => {
    const result = analyze("https://github.com/aegishield");
    expect(result.signals).toHaveLength(DEFAULT_RULES.length);
    expect(result.signals.map((s) => s.id)).toEqual(DEFAULT_RULES.map((r) => r.id));
    expect(result.layer).toBe("rules");
    expect(result.status).toBe("complete");
  });

  it("safe URL → score < 0.30 and no fired signals", () => {
    const result = analyze("https://github.com/aegishield/aegis-gorgon");
    expect(result.score).toBeLessThan(0.3);
    expect(result.signals.filter((s) => s.fired)).toHaveLength(0);
  });

  it("suspicious URL → some signals fire but score < 0.75", () => {
    const result = analyze("https://shop.example.co.uk/account/login");
    const fired = result.signals.filter((s) => s.fired);
    expect(fired.length).toBeGreaterThan(0);
    expect(result.score).toBeGreaterThanOrEqual(0.3);
    expect(result.score).toBeLessThan(0.75);
  });

  it("phishing URL → multiple high-severity signals and score >= 0.75", () => {
    const result = analyze(
      "http://paypal.com@192.168.0.1/login?next=http://evil.tk/steal",
    );
    const firedIds = result.signals.filter((s) => s.fired).map((s) => s.id);
    expect(firedIds).toEqual(
      expect.arrayContaining([
        "ip_hostname",
        "embedded_credentials",
        "url_in_url",
        "credential_keywords",
      ]),
    );
    expect(result.score).toBeGreaterThanOrEqual(0.75);
  });

  it("score is deterministic across repeated calls", () => {
    const a = analyze("https://shop.example.co.uk/account/login").score;
    const b = analyze("https://shop.example.co.uk/account/login").score;
    expect(a).toBe(b);
  });

  it("aggregate score is monotonic non-decreasing as fired signals are added", () => {
    const safeScore = analyze("https://example.com/").score;
    const oneSignalScore = analyze("https://example.com/login").score;
    const manySignalsScore = analyze(
      "http://paypal.com@192.168.0.1/login?next=http://evil.tk/steal",
    ).score;
    expect(oneSignalScore).toBeGreaterThan(safeScore);
    expect(manySignalsScore).toBeGreaterThan(oneSignalScore);
  });

  it("returns status='error' and isolates a single failing rule", () => {
    const broken = {
      id: "ip_hostname" as const,
      name: "broken",
      defaultWeight: 0,
      evaluate() {
        throw new Error("simulated rule failure");
      },
    };
    const engine = new RulesEngine({ rules: [broken, ...DEFAULT_RULES.slice(1)] });
    const result = engine.analyze(parseUrl("https://example.com/"));
    expect(result.status).toBe("error");
    expect(result.error).toContain("simulated rule failure");
    expect(result.signals).toHaveLength(DEFAULT_RULES.length);
  });

  it("typical analysis runs well under 10 ms per URL", () => {
    const samples = [
      "https://github.com/aegishield",
      "https://shop.example.co.uk/account/login",
      "https://xn--80ak6aa92e.com/",
      "http://paypal.com@192.168.0.1/login?next=http://evil.tk/steal",
      "https://news.ycombinator.com/item?id=1",
      "https://a.b.c.d.example.com/",
      "https://promo.top/free-stuff",
      "https://example.com/r?next=https://evil.example/login",
    ];
    const parsed = samples.map(parseUrl);
    const engine = new RulesEngine();
    const iterations = 200;
    const start = performance.now();
    for (let i = 0; i < iterations; i += 1) {
      engine.analyze(parsed[i % parsed.length]!);
    }
    const avg = (performance.now() - start) / iterations;
    expect(avg).toBeLessThan(10);
  });
});

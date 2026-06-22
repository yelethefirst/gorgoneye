import { describe, expect, it } from "vitest";
import { parseUrl } from "../../src/rules/parseUrl";
import { typosquattingRule } from "../../src/rules/rules/typosquatting";

function evaluate(rawUrl: string) {
  return typosquattingRule.evaluate(parseUrl(rawUrl));
}

describe("typosquattingRule", () => {
  it("fires on paypa1.example (digit-for-letter swap)", () => {
    const signal = evaluate("https://paypa1.example/login");
    expect(signal.fired).toBe(true);
    expect(signal.evidence.matchedBrand).toBe("PayPal");
    expect(signal.evidence.editDistance).toBe(1);
  });

  it("fires on goog1e.com (letter-to-digit substitution)", () => {
    const signal = evaluate("https://goog1e.com/");
    expect(signal.fired).toBe(true);
    expect(signal.evidence.matchedBrand).toBe("Google");
  });

  it("fires on micr0soft.net (zero-for-o substitution)", () => {
    const signal = evaluate("https://micr0soft.net/");
    expect(signal.fired).toBe(true);
    expect(signal.evidence.matchedBrand).toBe("Microsoft");
  });

  it("does NOT fire for the exact legitimate domain", () => {
    const signal = evaluate("https://www.paypal.com/account");
    expect(signal.fired).toBe(false);
  });

  it("does NOT fire for another exact brand domain", () => {
    const signal = evaluate("https://github.com/aegishield");
    expect(signal.fired).toBe(false);
  });

  it("does NOT fire for unrelated domains", () => {
    expect(evaluate("https://news.ycombinator.com/").fired).toBe(false);
    expect(evaluate("https://en.wikipedia.org/wiki/Phishing").fired).toBe(false);
  });

  it("does NOT fire for an IP-literal URL", () => {
    const signal = evaluate("http://192.168.0.1/login");
    expect(signal.fired).toBe(false);
  });

  it("does NOT fire for very short candidates (avoids noise)", () => {
    const signal = evaluate("https://ab.com/");
    expect(signal.fired).toBe(false);
  });

  it("does NOT fire for malformed URLs", () => {
    const signal = evaluate("not a url");
    expect(signal.fired).toBe(false);
  });

  it("returns the documented default weight (0.75)", () => {
    expect(typosquattingRule.defaultWeight).toBeCloseTo(0.75);
  });

  it("evaluates 100 URLs in well under 5ms each on average", () => {
    const urls = [
      "https://paypa1.example/",
      "https://goog1e.com/",
      "https://www.paypal.com/",
      "https://github.com/",
      "https://random.example.com/",
      "https://news.example.org/",
      "https://wikipedia.org/",
      "https://amaz0n.shop/",
      "https://app1e.com/",
      "https://netfllx.net/",
    ];
    const parsed = urls.map(parseUrl);
    const start = performance.now();
    const iterations = 100;
    for (let i = 0; i < iterations; i += 1) {
      const p = parsed[i % parsed.length]!;
      typosquattingRule.evaluate(p);
    }
    const elapsed = performance.now() - start;
    expect(elapsed / iterations).toBeLessThan(5);
  });
});

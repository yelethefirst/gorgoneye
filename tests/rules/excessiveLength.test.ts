import { describe, expect, it } from "vitest";
import { parseUrl } from "../../src/rules/parseUrl";
import {
  createExcessiveLengthRule,
  excessiveLengthRule,
} from "../../src/rules/rules/excessiveLength";

function ev(rawUrl: string) {
  return excessiveLengthRule.evaluate(parseUrl(rawUrl));
}

describe("excessiveLengthRule (defaults: 150 chars, 10% encoded)", () => {
  it("does NOT fire for short clean URLs", () => {
    expect(ev("https://example.com/path?a=1").fired).toBe(false);
  });

  it("fires for URLs longer than the configured threshold", () => {
    const longPath = "/a".repeat(120);
    const signal = ev(`https://example.com${longPath}`);
    expect(signal.fired).toBe(true);
    expect(signal.evidence.longUrl).toBe(true);
    expect(signal.evidence.heavyEncoding).toBe(false);
  });

  it("fires for heavy percent-encoding even when short", () => {
    const signal = ev("https://example.com/%20%20%20%20%20%20a");
    expect(signal.fired).toBe(true);
    expect(signal.evidence.heavyEncoding).toBe(true);
  });

  it("does NOT fire for one-off percent-encoded path segments", () => {
    expect(ev("https://example.com/a%20b").fired).toBe(false);
  });

  it("does NOT fire for malformed URLs", () => {
    expect(ev("not a url").fired).toBe(false);
  });

  it("uses default weight 0.35", () => {
    expect(excessiveLengthRule.defaultWeight).toBeCloseTo(0.35);
  });

  it("respects a stricter custom maxLength", () => {
    const rule = createExcessiveLengthRule({ maxLength: 30 });
    expect(rule.evaluate(parseUrl("https://example.com/path/that/is/notably/long")).fired).toBe(true);
  });

  it("respects a stricter custom percent-encoding threshold (with the >=3 count guard)", () => {
    const rule = createExcessiveLengthRule({ maxPercentEncodedRatio: 0.01 });
    // Three encoded sequences clear the count guard; ratio 9/40 > 0.01.
    expect(rule.evaluate(parseUrl("https://example.com/%20%20%20")).fired).toBe(true);
  });
});

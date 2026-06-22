import { describe, expect, it } from "vitest";
import { parseUrl } from "../../src/rules/parseUrl";
import { punycodeHomographRule } from "../../src/rules/rules/punycodeHomograph";

function evaluate(rawUrl: string) {
  return punycodeHomographRule.evaluate(parseUrl(rawUrl));
}

describe("punycodeHomographRule", () => {
  it("fires on an xn-- label and includes a decoded display form", () => {
    // xn--80ak6aa92e.com decodes to "арӏе.com" / Cyrillic-like
    const signal = evaluate("https://xn--80ak6aa92e.com/");
    expect(signal.fired).toBe(true);
    expect(signal.evidence.usesPunycode).toBe(true);
    expect(signal.evidence.encodedHostname).toBe("xn--80ak6aa92e.com");
    expect(signal.evidence.decodedHostname).not.toBe("xn--80ak6aa92e.com");
  });

  it("fires on a Cyrillic IDN that round-trips through punycode", () => {
    // "пример.рф" — pure Russian
    const signal = evaluate("https://xn--e1afmkfd.xn--p1ai/");
    expect(signal.fired).toBe(true);
    expect(signal.evidence.usesPunycode).toBe(true);
  });

  it("fires on a mixed-script label (Latin + Cyrillic)", () => {
    // "аpple.com" — first letter is Cyrillic а (U+0430), rest Latin.
    // The URL parser punycode-encodes the Cyrillic-bearing label.
    const signal = evaluate("https://аpple.com/");
    expect(signal.fired).toBe(true);
    expect(signal.evidence.hasMixedScriptLabel).toBe(true);
    const labels = signal.evidence.mixedScriptLabels as string[];
    expect(labels.join(",")).toMatch(/Cyrillic/);
    expect(labels.join(",")).toMatch(/Latin/);
    expect(signal.severity).toBe("high");
  });

  it("does NOT fire for a plain ASCII hostname", () => {
    const signal = evaluate("https://www.example.com/path");
    expect(signal.fired).toBe(false);
  });

  it("does NOT fire for an IP-literal hostname", () => {
    const signal = evaluate("http://192.168.1.1/");
    expect(signal.fired).toBe(false);
  });

  it("does NOT fire for malformed URLs", () => {
    expect(evaluate("not a url").fired).toBe(false);
  });

  it("treats UPPERCASE xn-- prefixes the same as lowercase", () => {
    const signal = evaluate("https://XN--80AK6AA92E.com/");
    expect(signal.fired).toBe(true);
    expect(signal.evidence.usesPunycode).toBe(true);
  });

  it("uses the documented default weight (0.55)", () => {
    expect(punycodeHomographRule.defaultWeight).toBeCloseTo(0.55);
  });
});

import { describe, expect, it } from "vitest";
import { parseUrl } from "../../src/rules/parseUrl";
import { urlInUrlRule } from "../../src/rules/rules/urlInUrl";

function ev(rawUrl: string) {
  return urlInUrlRule.evaluate(parseUrl(rawUrl));
}

describe("urlInUrlRule", () => {
  it("fires for an open-redirect-style query parameter", () => {
    const signal = ev("https://example.com/r?next=https://evil.example/login");
    expect(signal.fired).toBe(true);
    expect(signal.evidence.embeddedSurface).toBe("query");
    expect(String(signal.evidence.embeddedUrl)).toContain("evil.example");
  });

  it("fires when the embedded URL is percent-encoded in the query", () => {
    const signal = ev("https://example.com/go?to=https%3A%2F%2Fevil.example%2Fpath");
    expect(signal.fired).toBe(true);
    expect(signal.evidence.embeddedSurface).toBe("query");
  });

  it("fires when another URL is concatenated into the path", () => {
    const signal = ev("https://example.com/proxy/https://evil.example/x");
    expect(signal.fired).toBe(true);
    expect(signal.evidence.embeddedSurface).toBe("path");
  });

  it("fires when a URL appears in the fragment", () => {
    const signal = ev("https://example.com/#https://evil.example");
    expect(signal.fired).toBe(true);
    expect(signal.evidence.embeddedSurface).toBe("fragment");
  });

  it("does NOT fire when no embedded URL is present", () => {
    expect(ev("https://example.com/path?a=1&b=2").fired).toBe(false);
  });

  it("does NOT fire for the first/outer URL alone", () => {
    expect(ev("https://example.com/").fired).toBe(false);
  });

  it("does NOT fire for malformed URLs", () => {
    expect(ev("not a url").fired).toBe(false);
  });

  it("uses default weight 0.45", () => {
    expect(urlInUrlRule.defaultWeight).toBeCloseTo(0.45);
  });
});

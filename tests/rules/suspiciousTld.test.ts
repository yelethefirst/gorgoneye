import { describe, expect, it } from "vitest";
import { parseUrl } from "../../src/rules/parseUrl";
import {
  createSuspiciousTldRule,
  suspiciousTldRule,
} from "../../src/rules/rules/suspiciousTld";

function ev(rawUrl: string) {
  return suspiciousTldRule.evaluate(parseUrl(rawUrl));
}

describe("suspiciousTldRule (default list)", () => {
  it("fires for .tk", () => {
    const signal = ev("https://login-update.tk/account");
    expect(signal.fired).toBe(true);
    expect(signal.evidence.tld).toBe("tk");
  });

  it("fires for .top", () => {
    expect(ev("https://promo.top/").fired).toBe(true);
  });

  it("fires for .zip", () => {
    expect(ev("https://invoice.zip/file").fired).toBe(true);
  });

  it("does NOT fire for .com", () => {
    expect(ev("https://example.com/").fired).toBe(false);
  });

  it("does NOT fire for multi-label suffixes like co.uk", () => {
    expect(ev("https://shop.example.co.uk/").fired).toBe(false);
  });

  it("does NOT fire for .io or .dev", () => {
    expect(ev("https://api.example.io/").fired).toBe(false);
    expect(ev("https://docs.example.dev/").fired).toBe(false);
  });

  it("does NOT fire for IP-literal URLs (no TLD)", () => {
    expect(ev("http://192.168.1.1/").fired).toBe(false);
  });

  it("does NOT fire for malformed URLs", () => {
    expect(ev("not a url").fired).toBe(false);
  });

  it("uses default weight 0.35", () => {
    expect(suspiciousTldRule.defaultWeight).toBeCloseTo(0.35);
  });
});

describe("createSuspiciousTldRule(custom list)", () => {
  it("respects a custom allowlist that excludes defaults", () => {
    const custom = createSuspiciousTldRule({ tlds: ["example"] });
    const signal = custom.evaluate(parseUrl("https://shop.tk/"));
    expect(signal.fired).toBe(false);
  });

  it("respects a custom list that adds a new TLD", () => {
    const custom = createSuspiciousTldRule({ tlds: ["pizza"] });
    const signal = custom.evaluate(parseUrl("https://offers.pizza/"));
    expect(signal.fired).toBe(true);
  });

  it("normalizes the custom list to lowercase", () => {
    const custom = createSuspiciousTldRule({ tlds: ["XYZ"] });
    expect(custom.evaluate(parseUrl("https://shop.xyz/")).fired).toBe(true);
  });
});

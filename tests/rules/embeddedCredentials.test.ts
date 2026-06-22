import { describe, expect, it } from "vitest";
import { parseUrl } from "../../src/rules/parseUrl";
import { embeddedCredentialsRule } from "../../src/rules/rules/embeddedCredentials";

function ev(rawUrl: string) {
  return embeddedCredentialsRule.evaluate(parseUrl(rawUrl));
}

describe("embeddedCredentialsRule", () => {
  it("fires when the URL contains user:pass userinfo", () => {
    const signal = ev("https://paypal.com@evil.example/login");
    expect(signal.fired).toBe(true);
    expect(signal.severity).toBe("high");
    expect(signal.evidence.realHostname).toBe("evil.example");
    expect(signal.evidence.hasPassword).toBe(false);
  });

  it("fires when only a username is present", () => {
    const signal = ev("https://alice@example.com/");
    expect(signal.fired).toBe(true);
    expect(signal.evidence.hasPassword).toBe(false);
  });

  it("fires when both username and password are present", () => {
    const signal = ev("http://user:pass@10.0.0.1/admin");
    expect(signal.fired).toBe(true);
    expect(signal.evidence.hasPassword).toBe(true);
  });

  it("does NOT fire for @ that appears only in the path", () => {
    const signal = ev("https://example.com/users/@alice");
    expect(signal.fired).toBe(false);
  });

  it("does NOT fire for a plain URL", () => {
    expect(ev("https://example.com/path?a=1").fired).toBe(false);
  });

  it("does NOT fire for malformed URLs", () => {
    expect(ev("not a url").fired).toBe(false);
  });

  it("uses default weight 0.80", () => {
    expect(embeddedCredentialsRule.defaultWeight).toBeCloseTo(0.8);
  });
});

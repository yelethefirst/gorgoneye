import { describe, expect, it } from "vitest";
import { parseUrl } from "../../src/rules/parseUrl";
import {
  createExcessiveSubdomainsRule,
  excessiveSubdomainsRule,
} from "../../src/rules/rules/excessiveSubdomains";

function ev(rawUrl: string) {
  return excessiveSubdomainsRule.evaluate(parseUrl(rawUrl));
}

describe("excessiveSubdomainsRule (default threshold 3)", () => {
  it("does NOT fire for no subdomain", () => {
    expect(ev("https://example.com/").fired).toBe(false);
  });

  it("does NOT fire for a single subdomain", () => {
    expect(ev("https://www.example.com/").fired).toBe(false);
  });

  it("does NOT fire for three subdomain labels (at threshold)", () => {
    expect(ev("https://a.b.c.example.com/").fired).toBe(false);
  });

  it("fires for four subdomain labels", () => {
    const signal = ev("https://a.b.c.d.example.com/");
    expect(signal.fired).toBe(true);
    expect(signal.evidence.depth).toBe(4);
    expect(signal.evidence.threshold).toBe(3);
  });

  it("fires for five subdomain labels", () => {
    const signal = ev("https://a.b.c.d.e.example.co.uk/");
    expect(signal.fired).toBe(true);
    expect(signal.evidence.depth).toBe(5);
    expect(signal.evidence.registrableDomain).toBe("example.co.uk");
  });

  it("does NOT fire for IP-literal hostnames", () => {
    expect(ev("http://192.168.1.1/").fired).toBe(false);
    expect(ev("http://[2001:db8::1]/").fired).toBe(false);
  });

  it("does NOT fire for malformed URLs", () => {
    expect(ev("not a url").fired).toBe(false);
  });

  it("uses default weight 0.35", () => {
    expect(excessiveSubdomainsRule.defaultWeight).toBeCloseTo(0.35);
  });
});

describe("createExcessiveSubdomainsRule(custom threshold)", () => {
  it("respects a stricter threshold of 1", () => {
    const rule = createExcessiveSubdomainsRule({ threshold: 1 });
    const signal = rule.evaluate(parseUrl("https://a.b.example.com/"));
    expect(signal.fired).toBe(true);
    expect(signal.evidence.depth).toBe(2);
    expect(signal.evidence.threshold).toBe(1);
  });

  it("respects a looser threshold of 5", () => {
    const rule = createExcessiveSubdomainsRule({ threshold: 5 });
    expect(rule.evaluate(parseUrl("https://a.b.c.d.example.com/")).fired).toBe(false);
    expect(rule.evaluate(parseUrl("https://a.b.c.d.e.f.example.com/")).fired).toBe(true);
  });
});

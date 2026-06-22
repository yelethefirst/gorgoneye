import { describe, expect, it } from "vitest";
import { parseUrl } from "../../src/rules/parseUrl";
import {
  createCredentialKeywordsRule,
  credentialKeywordsRule,
} from "../../src/rules/rules/credentialKeywords";

function ev(rawUrl: string) {
  return credentialKeywordsRule.evaluate(parseUrl(rawUrl));
}

describe("credentialKeywordsRule (default list)", () => {
  it("fires when the path contains 'login'", () => {
    const signal = ev("https://example.com/account/login");
    expect(signal.fired).toBe(true);
    const matched = signal.evidence.matchedKeywords as string[];
    expect(matched).toEqual(expect.arrayContaining(["login", "account"]));
    expect(signal.evidence.matchedSurfaces).toContain("path");
  });

  it("fires when a keyword appears in the query string", () => {
    const signal = ev("https://example.com/index.html?action=verify");
    expect(signal.fired).toBe(true);
    expect(signal.evidence.matchedSurfaces).toContain("query");
  });

  it("fires when a keyword appears in the fragment", () => {
    const signal = ev("https://example.com/page#reset-password");
    expect(signal.fired).toBe(true);
    expect(signal.evidence.matchedSurfaces).toContain("fragment");
    const matched = signal.evidence.matchedKeywords as string[];
    expect(matched).toEqual(expect.arrayContaining(["reset", "password"]));
  });

  it("is case-insensitive", () => {
    const signal = ev("https://example.com/AcCount/Verify");
    expect(signal.fired).toBe(true);
    const matched = signal.evidence.matchedKeywords as string[];
    expect(matched).toEqual(expect.arrayContaining(["account", "verify"]));
  });

  it("does NOT fire for clean paths", () => {
    expect(ev("https://example.com/articles/2024/news").fired).toBe(false);
    expect(ev("https://shop.example.com/checkout/item/123").fired).toBe(false);
  });

  it("does NOT fire for malformed URLs", () => {
    expect(ev("not a url").fired).toBe(false);
  });

  it("uses default weight 0.30", () => {
    expect(credentialKeywordsRule.defaultWeight).toBeCloseTo(0.3);
  });

  it("returns deduplicated matchedKeywords across multiple surfaces", () => {
    const signal = ev("https://example.com/login?next=/login#login");
    expect(signal.fired).toBe(true);
    const matched = signal.evidence.matchedKeywords as string[];
    expect(matched.filter((k) => k === "login").length).toBe(1);
    const surfaces = signal.evidence.matchedSurfaces as string[];
    expect(surfaces).toEqual(expect.arrayContaining(["path", "query", "fragment"]));
  });
});

describe("createCredentialKeywordsRule(custom list)", () => {
  it("replaces the default keywords", () => {
    const rule = createCredentialKeywordsRule({ keywords: ["wire-transfer"] });
    expect(rule.evaluate(parseUrl("https://example.com/login")).fired).toBe(false);
    expect(rule.evaluate(parseUrl("https://example.com/wire-transfer/now")).fired).toBe(true);
  });

  it("normalizes custom keywords to lowercase and dedupes", () => {
    const rule = createCredentialKeywordsRule({ keywords: ["Bonus", "BONUS", "bonus"] });
    const signal = rule.evaluate(parseUrl("https://example.com/Bonus/claim"));
    expect(signal.fired).toBe(true);
    expect((signal.evidence.matchedKeywords as string[]).length).toBe(1);
  });
});

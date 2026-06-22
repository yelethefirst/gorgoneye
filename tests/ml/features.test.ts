import { describe, expect, it } from "vitest";
import { extractFeatures, extractFeaturesByName } from "../../src/ml/features";
import { FEATURE_COUNT, FEATURE_INDEX, FEATURE_NAMES } from "../../src/ml/featureSchema";
import { parseUrl } from "../../src/rules/parseUrl";

describe("extractFeatures (shape + invariants)", () => {
  it("returns a Float32Array of exactly FEATURE_COUNT elements", () => {
    const out = extractFeatures(parseUrl("https://example.com/"));
    expect(out).toBeInstanceOf(Float32Array);
    expect(out.length).toBe(FEATURE_COUNT);
  });

  it("FEATURE_NAMES and FEATURE_INDEX agree on order", () => {
    FEATURE_NAMES.forEach((name, i) => {
      expect(FEATURE_INDEX[name]).toBe(i);
    });
  });

  it("flags https + non-IP + ASCII host correctly for a clean URL", () => {
    const v = extractFeaturesByName(parseUrl("https://news.ycombinator.com/item?id=42"));
    expect(v.is_https).toBe(1);
    expect(v.is_ip_address).toBe(0);
    expect(v.is_punycode).toBe(0);
    expect(v.is_idn).toBe(0);
    expect(v.has_credential_keyword).toBe(0);
    expect(v.has_embedded_url).toBe(0);
    expect(v.at_in_url_userinfo).toBe(0);
    // 'ycombinator' isn't on the protected list; the feature reports the
    // best (worst) distance to any in-range brand, so it's > 0 but not 0.
    expect(v.min_brand_edit_distance).toBeGreaterThan(0);
  });

  it("min_brand_edit_distance is 0 for an exact protected-brand SLD", () => {
    const v = extractFeaturesByName(parseUrl("https://www.paypal.com/account"));
    expect(v.min_brand_edit_distance).toBe(0);
  });

  it("min_brand_edit_distance is 1 for a typosquat that lands within the gap filter", () => {
    const v = extractFeaturesByName(parseUrl("https://paypa1.example/login"));
    expect(v.min_brand_edit_distance).toBe(1);
  });

  it("min_brand_edit_distance is -1 for an IP-literal URL", () => {
    const v = extractFeaturesByName(parseUrl("http://10.0.0.1/account"));
    expect(v.min_brand_edit_distance).toBe(-1);
    expect(v.is_ip_address).toBe(1);
  });

  it("at_in_url_userinfo is 1 for the @-trick fixture", () => {
    const v = extractFeaturesByName(parseUrl("http://paypal.com@evil.example/login"));
    expect(v.at_in_url_userinfo).toBe(1);
  });

  it("at_in_url_userinfo is 0 when '@' is only in the path", () => {
    const v = extractFeaturesByName(parseUrl("https://example.com/users/@alice"));
    expect(v.at_in_url_userinfo).toBe(0);
  });

  it("has_embedded_url catches both raw and percent-encoded URLs", () => {
    expect(
      extractFeaturesByName(parseUrl("https://example.com/r?to=https://evil.example"))
        .has_embedded_url,
    ).toBe(1);
    expect(
      extractFeaturesByName(
        parseUrl("https://example.com/go?u=https%3A%2F%2Fevil.example"),
      ).has_embedded_url,
    ).toBe(1);
    expect(extractFeaturesByName(parseUrl("https://example.com/")).has_embedded_url).toBe(0);
  });

  it("entropy is 0 for empty strings and grows for variety", () => {
    const a = extractFeaturesByName(parseUrl("https://a.com/"));
    const b = extractFeaturesByName(parseUrl("https://aaaaa.com/"));
    const c = extractFeaturesByName(parseUrl("https://x4f-zq.example/"));
    expect(a.path_entropy).toBe(0); // path is "/" → 1 char, entropy 0
    expect(b.host_entropy).toBeLessThan(c.host_entropy!);
  });

  it("URL-length buckets saturate correctly", () => {
    const short = extractFeaturesByName(parseUrl("https://example.com/short"));
    expect(short.url_length_bucket_long).toBe(0);
    expect(short.url_length_bucket_very_long).toBe(0);

    const longPath = "/x".repeat(60); // → ~120-char URL
    const long = extractFeaturesByName(parseUrl(`https://example.com${longPath}`));
    expect(long.url_length_bucket_long).toBe(1);
    expect(long.url_length_bucket_very_long).toBe(0);

    const veryLongPath = "/x".repeat(110); // → ~220-char URL
    const veryLong = extractFeaturesByName(
      parseUrl(`https://example.com${veryLongPath}`),
    );
    expect(veryLong.url_length_bucket_very_long).toBe(1);
  });
});

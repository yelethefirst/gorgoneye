import { describe, expect, it } from "vitest";
import { parseUrl } from "../src/rules/parseUrl";

describe("parseUrl", () => {
  it("parses a simple https URL", () => {
    const out = parseUrl("https://www.example.com/path?q=1#frag");
    expect(out.parseError).toBeUndefined();
    expect(out.scheme).toBe("https");
    expect(out.hostname).toBe("www.example.com");
    expect(out.registrableDomain).toBe("example.com");
    expect(out.publicSuffix).toBe("com");
    expect(out.subdomain).toBe("www");
    expect(out.path).toBe("/path");
    expect(out.query).toBe("q=1");
    expect(out.fragment).toBe("frag");
    expect(out.isIpAddress).toBe(false);
    expect(out.canonicalUrl).toBe("https://www.example.com/path?q=1");
  });

  it("lowercases scheme and hostname in the canonical URL", () => {
    const out = parseUrl("HTTPS://Example.COM/Path");
    expect(out.scheme).toBe("https");
    expect(out.hostname).toBe("example.com");
    expect(out.canonicalUrl).toBe("https://example.com/Path");
  });

  it("preserves a non-default port", () => {
    const out = parseUrl("https://example.com:8443/x");
    expect(out.port).toBe("8443");
    expect(out.canonicalUrl).toBe("https://example.com:8443/x");
  });

  it("strips the default https port", () => {
    const out = parseUrl("https://example.com:443/x");
    expect(out.canonicalUrl).toBe("https://example.com/x");
  });

  it("defaults the path to / when empty", () => {
    const out = parseUrl("https://example.com");
    expect(out.path).toBe("/");
    expect(out.canonicalUrl).toBe("https://example.com/");
  });

  it("detects deep subdomains", () => {
    const out = parseUrl("https://a.b.c.example.co.uk/");
    expect(out.subdomain).toBe("a.b.c");
    expect(out.registrableDomain).toBe("example.co.uk");
    expect(out.publicSuffix).toBe("co.uk");
  });

  it("detects an IPv4 hostname", () => {
    const out = parseUrl("http://192.168.1.10/admin");
    expect(out.isIpAddress).toBe(true);
    expect(out.hostname).toBe("192.168.1.10");
    expect(out.registrableDomain).toBeNull();
    expect(out.publicSuffix).toBeNull();
  });

  it("detects an IPv6 hostname and keeps the brackets", () => {
    const out = parseUrl("http://[2001:db8::1]:8080/path");
    expect(out.isIpAddress).toBe(true);
    expect(out.port).toBe("8080");
    expect(out.canonicalUrl).toBe("http://[2001:db8::1]:8080/path");
  });

  it("flags a punycode label as IDN + punycode", () => {
    const out = parseUrl("https://xn--80ak6aa92e.com/");
    expect(out.isPunycode).toBe(true);
    expect(out.isIdn).toBe(true);
    expect(out.isIpAddress).toBe(false);
  });

  it("flags raw non-ASCII hostnames as IDN", () => {
    const out = parseUrl("https://例え.jp/");
    expect(out.parseError).toBeUndefined();
    expect(out.isIdn).toBe(true);
  });

  it("returns a parse error for a malformed URL", () => {
    const out = parseUrl("http://");
    expect(out.parseError).toBe("invalid_url");
    expect(out.scheme).toBe("");
  });

  it("returns a parse error for empty input", () => {
    const out = parseUrl("   ");
    expect(out.parseError).toBe("empty_input");
  });

  it("returns a parse error for non-string input", () => {
    const out = parseUrl(undefined);
    expect(out.parseError).toBe("non_string_input");
  });

  it("handles a javascript: scheme without crashing", () => {
    const out = parseUrl("javascript:alert(1)");
    expect(out.scheme).toBe("javascript");
    expect(out.hostname).toBeNull();
    expect(out.parseError).toBeUndefined();
  });

  it("handles a data: scheme", () => {
    const out = parseUrl("data:text/plain;base64,SGVsbG8=");
    expect(out.scheme).toBe("data");
    expect(out.hostname).toBeNull();
  });

  it("handles a mailto: scheme", () => {
    const out = parseUrl("mailto:alice@example.com");
    expect(out.scheme).toBe("mailto");
    expect(out.hostname).toBeNull();
  });

  it("handles a file: URL", () => {
    const out = parseUrl("file:///etc/hosts");
    expect(out.scheme).toBe("file");
    expect(out.path).toBe("/etc/hosts");
  });

  it("decodes userinfo into a host (and does not put @ in hostname)", () => {
    const out = parseUrl("http://user:pass@example.com/secret");
    expect(out.hostname).toBe("example.com");
    expect(out.canonicalUrl.includes("user")).toBe(false);
  });

  it("preserves @ inside a path", () => {
    const out = parseUrl("https://example.com/users/@alice");
    expect(out.hostname).toBe("example.com");
    expect(out.path).toBe("/users/@alice");
  });

  it("preserves trailing slash but drops default port", () => {
    const out = parseUrl("https://example.com:443/");
    expect(out.canonicalUrl).toBe("https://example.com/");
  });

  it("captures query parameters", () => {
    const out = parseUrl("https://example.com/path?a=1&b=2");
    expect(out.query).toBe("a=1&b=2");
  });

  it("strips the fragment from the canonical form", () => {
    const out = parseUrl("https://example.com/path?a=1#section");
    expect(out.canonicalUrl).toBe("https://example.com/path?a=1");
    expect(out.fragment).toBe("section");
  });

  it("returns null subdomain when there is none", () => {
    const out = parseUrl("https://example.com/");
    expect(out.subdomain).toBeNull();
  });

  it("treats co.uk-style suffixes correctly", () => {
    const out = parseUrl("https://shop.example.co.uk/");
    expect(out.registrableDomain).toBe("example.co.uk");
    expect(out.subdomain).toBe("shop");
  });

  it("flags percent-encoded paths without losing them", () => {
    const out = parseUrl("https://example.com/a%20b%2Fc");
    expect(out.path).toBe("/a%20b%2Fc");
  });

  it("handles uppercase IDN punycode mixed-case", () => {
    const out = parseUrl("https://XN--80AK6AA92E.com/");
    expect(out.isPunycode).toBe(true);
    expect(out.hostname).toBe("xn--80ak6aa92e.com");
  });
});

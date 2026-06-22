import { describe, expect, it } from "vitest";
import { canonicalizeForSafeBrowsing } from "../../src/threat-intel/canonicalize";

describe("canonicalizeForSafeBrowsing", () => {
  it("lowercases the scheme and host", () => {
    expect(canonicalizeForSafeBrowsing("HTTPS://Example.COM/Path")).toBe(
      "https://example.com/Path",
    );
  });

  it("drops the fragment", () => {
    expect(canonicalizeForSafeBrowsing("https://example.com/x#frag")).toBe(
      "https://example.com/x",
    );
  });

  it("collapses repeated slashes in the path", () => {
    expect(canonicalizeForSafeBrowsing("https://example.com//a///b")).toBe(
      "https://example.com/a/b",
    );
  });

  it("resolves dot and double-dot segments in the path", () => {
    expect(canonicalizeForSafeBrowsing("https://example.com/a/./b/../c")).toBe(
      "https://example.com/a/c",
    );
  });

  it("trims leading/trailing dots and collapses consecutive dots in the host", () => {
    expect(canonicalizeForSafeBrowsing("https://..example..com../x")).toBe(
      "https://example.com/x",
    );
  });

  it("strips tab, CR, LF, and surrounding whitespace", () => {
    expect(canonicalizeForSafeBrowsing("  https://example.com/a\tb\n  ")).toBe(
      "https://example.com/ab",
    );
  });

  it("percent-escapes spaces in the path", () => {
    expect(canonicalizeForSafeBrowsing("https://example.com/hello world")).toBe(
      "https://example.com/hello%20world",
    );
  });

  it("returns null for non-http(s) schemes", () => {
    expect(canonicalizeForSafeBrowsing("javascript:alert(1)")).toBeNull();
    expect(canonicalizeForSafeBrowsing("ftp://example.com")).toBeNull();
  });

  it("returns null for empty / unparseable inputs", () => {
    expect(canonicalizeForSafeBrowsing("")).toBeNull();
    expect(canonicalizeForSafeBrowsing("   ")).toBeNull();
    expect(canonicalizeForSafeBrowsing("not a url")).toBeNull();
  });

  it("keeps non-default ports", () => {
    expect(canonicalizeForSafeBrowsing("https://example.com:8443/x")).toBe(
      "https://example.com:8443/x",
    );
  });
});

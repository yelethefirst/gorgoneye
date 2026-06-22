import { describe, expect, it } from "vitest";
import { enumerateUrlExpressions } from "../../src/threat-intel/expressions";

describe("enumerateUrlExpressions", () => {
  it("includes the exact host+path and the bare host", () => {
    const exps = enumerateUrlExpressions("https://example.com/a/b?q=1");
    expect(exps).toContain("example.com/a/b?q=1");
    expect(exps).toContain("example.com/a/b");
    expect(exps).toContain("example.com/");
  });

  it("walks parent path prefixes for deep paths", () => {
    const exps = enumerateUrlExpressions("https://example.com/a/b/c/d");
    expect(exps).toContain("example.com/a/b/c/");
    expect(exps).toContain("example.com/a/b/");
    expect(exps).toContain("example.com/a/");
    expect(exps).toContain("example.com/");
  });

  it("walks host suffixes for multi-label hostnames", () => {
    const exps = enumerateUrlExpressions("https://a.b.example.co.uk/x");
    expect(exps.some((e) => e.startsWith("a.b.example.co.uk"))).toBe(true);
    expect(exps.some((e) => e.startsWith("b.example.co.uk"))).toBe(true);
    expect(exps.some((e) => e.startsWith("example.co.uk"))).toBe(true);
  });

  it("does not produce duplicates and caps total expressions", () => {
    const exps = enumerateUrlExpressions("https://a.b.c.d.e.example.com/1/2/3/4/5?p=1");
    expect(new Set(exps).size).toBe(exps.length);
    expect(exps.length).toBeLessThanOrEqual(30);
  });

  it("returns [] for invalid inputs", () => {
    expect(enumerateUrlExpressions("not a url")).toEqual([]);
  });
});

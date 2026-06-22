import { describe, expect, it } from "vitest";
import {
  addTrustedDomain,
  removeTrustedDomain,
} from "../../../src/ui/options/trustedDomainsReducer";

describe("addTrustedDomain", () => {
  it("appends a valid domain in lowercase", () => {
    const out = addTrustedDomain([], "Example.COM");
    expect(out.error).toBeNull();
    expect(out.added).toBe("example.com");
    expect(out.next).toEqual(["example.com"]);
  });

  it("rejects an empty entry", () => {
    expect(addTrustedDomain([], "   ").error).toBe("empty");
  });

  it("rejects invalid characters", () => {
    expect(addTrustedDomain([], "exa mple.com").error).toBe("invalid_chars");
    expect(addTrustedDomain([], "exa/mple.com").error).toBe("invalid_chars");
  });

  it("rejects entries with no dot", () => {
    expect(addTrustedDomain([], "localhost").error).toBe("no_dot");
  });

  it("rejects entries that start or end with a dot", () => {
    expect(addTrustedDomain([], ".example.com").error).toBe("leading_or_trailing_dot");
    expect(addTrustedDomain([], "example.com.").error).toBe("leading_or_trailing_dot");
  });

  it("rejects duplicates", () => {
    expect(addTrustedDomain(["example.com"], "EXAMPLE.com").error).toBe("duplicate");
  });

  it("preserves the input list on every error path", () => {
    const list = ["example.com"];
    for (const bad of ["", "no dots", "no/dots", "trailing.", ".leading", "example.com"]) {
      const out = addTrustedDomain(list, bad);
      expect(out.next).toEqual(list);
      expect(out.added).toBeNull();
    }
  });
});

describe("removeTrustedDomain", () => {
  it("removes the exact entry", () => {
    expect(removeTrustedDomain(["a.com", "b.com"], "a.com")).toEqual(["b.com"]);
  });
  it("is a no-op when the entry is missing", () => {
    expect(removeTrustedDomain(["a.com"], "missing.com")).toEqual(["a.com"]);
  });
});

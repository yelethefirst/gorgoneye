import { describe, expect, it } from "vitest";
import { makeIsTrusted } from "../../../src/ui/generic/trusted";

describe("makeIsTrusted", () => {
  it("matches an exact hostname entry", () => {
    const isTrusted = makeIsTrusted(["mail.google.com"]);
    expect(isTrusted("https://mail.google.com/inbox")).toBe(true);
    expect(isTrusted("https://drive.google.com/")).toBe(false);
  });

  it("matches by registrable domain when an eTLD+1 entry is provided", () => {
    const isTrusted = makeIsTrusted(["google.com"]);
    expect(isTrusted("https://mail.google.com/inbox")).toBe(true);
    expect(isTrusted("https://drive.google.com/")).toBe(true);
    expect(isTrusted("https://example.com/")).toBe(false);
  });

  it("is case-insensitive", () => {
    const isTrusted = makeIsTrusted(["GitHub.com"]);
    expect(isTrusted("https://GITHUB.COM/aegishield")).toBe(true);
  });

  it("returns false for malformed URLs", () => {
    const isTrusted = makeIsTrusted(["github.com"]);
    expect(isTrusted("not a url")).toBe(false);
  });

  it("an empty list never trusts anything", () => {
    const isTrusted = makeIsTrusted([]);
    expect(isTrusted("https://anywhere.example/")).toBe(false);
  });

  it("trims whitespace and drops empty entries", () => {
    const isTrusted = makeIsTrusted(["  github.com  ", "", "   "]);
    expect(isTrusted("https://github.com/")).toBe(true);
  });
});

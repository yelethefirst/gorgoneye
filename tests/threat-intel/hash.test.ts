import { describe, expect, it } from "vitest";
import { bytesToHex, hexToBytes, sha256, sha256Hex } from "../../src/shared/hash";
import {
  hashStartsWithPrefix,
  hashWithPrefix,
} from "../../src/threat-intel/hash";

// Well-known SHA-256 vectors (FIPS 180-4 / NIST).
const VECTORS: Array<{ input: string; hex: string }> = [
  {
    input: "",
    hex: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  },
  {
    input: "abc",
    hex: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  },
  {
    input: "hello world",
    hex: "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
  },
];

describe("sha256 / sha256Hex", () => {
  it.each(VECTORS)("matches the known digest for %j", async ({ input, hex }) => {
    await expect(sha256Hex(input)).resolves.toBe(hex);
    const bytes = await sha256(input);
    expect(bytes.length).toBe(32);
    expect(bytesToHex(bytes)).toBe(hex);
  });
});

describe("bytesToHex / hexToBytes", () => {
  it("round-trips arbitrary byte arrays", () => {
    const bytes = new Uint8Array([0, 1, 16, 127, 128, 254, 255]);
    expect(hexToBytes(bytesToHex(bytes))).toEqual(bytes);
  });

  it("hexToBytes rejects odd-length input", () => {
    expect(() => hexToBytes("abc")).toThrow(/even length/);
  });

  it("hexToBytes rejects non-hex characters", () => {
    expect(() => hexToBytes("zzzz")).toThrow(/invalid hex/);
  });
});

describe("hashWithPrefix", () => {
  it("returns a 4-byte prefix by default", async () => {
    const out = await hashWithPrefix("abc");
    expect(out.prefix.length).toBe(4);
    expect(out.prefixHex).toBe("ba7816bf");
    expect(out.hashHex).toBe(VECTORS[1]!.hex);
  });

  it("respects a custom prefixBytes argument", async () => {
    const out = await hashWithPrefix("abc", 8);
    expect(out.prefix.length).toBe(8);
    expect(out.prefixHex).toBe("ba7816bf8f01cfea");
  });

  it("rejects prefixBytes below 4 or above 32", async () => {
    await expect(hashWithPrefix("x", 3)).rejects.toThrow(/prefixBytes/);
    await expect(hashWithPrefix("x", 33)).rejects.toThrow(/prefixBytes/);
  });

  it("rejects a non-integer prefixBytes argument", async () => {
    await expect(hashWithPrefix("x", 4.5)).rejects.toThrow(/integer/);
  });
});

describe("hashStartsWithPrefix", () => {
  it("matches a prefix that is a true leading subsequence", async () => {
    const out = await hashWithPrefix("abc", 4);
    expect(hashStartsWithPrefix(out.hash, out.prefix)).toBe(true);
  });

  it("rejects a prefix whose bytes diverge", async () => {
    const out = await hashWithPrefix("abc", 4);
    const altered = new Uint8Array(out.prefix);
    altered[0] = (altered[0]! + 1) & 0xff;
    expect(hashStartsWithPrefix(out.hash, altered)).toBe(false);
  });

  it("rejects a prefix longer than the hash", () => {
    const hash = new Uint8Array([1, 2, 3]);
    const longer = new Uint8Array([1, 2, 3, 4]);
    expect(hashStartsWithPrefix(hash, longer)).toBe(false);
  });
});

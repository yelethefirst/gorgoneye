import { describe, expect, it } from "vitest";
import { isBrandSpoof, nearestBrand } from "../../src/visual/matcher";
import { pHashFromHex } from "../../src/visual/phash";
import type { BrandEntry } from "../../src/visual/brandDb";

const TEST_BRANDS: BrandEntry[] = [
  {
    brand: "TestPay",
    legitimateDomains: ["testpay.example"],
    pHashHex: "ffff000000000000",
    capturedAt: "2026-06-01",
    captureNotes: "test",
  },
  {
    brand: "ConfusableCorp",
    legitimateDomains: ["confusable.example", "confusable.co.uk"],
    pHashHex: "aaaaaaaaaaaaaaaa",
    capturedAt: "2026-06-01",
    captureNotes: "test",
  },
];

describe("nearestBrand", () => {
  it("returns null when nothing is within the threshold", () => {
    // 0x0000... is 32 bits away from 0xaaaa... and 32 from 0xffff0000.
    const result = nearestBrand(0n, { brands: TEST_BRANDS, threshold: 4 });
    expect(result).toBeNull();
  });

  it("returns an exact match with distance 0", () => {
    const hash = pHashFromHex("ffff000000000000");
    const result = nearestBrand(hash, { brands: TEST_BRANDS });
    expect(result).not.toBeNull();
    expect(result!.brand.brand).toBe("TestPay");
    expect(result!.hammingDistance).toBe(0);
    expect(result!.similarity).toBe(1);
  });

  it("picks the closer brand when two are within threshold", () => {
    // A hash that's 2 bits away from TestPay and ~30 bits from ConfusableCorp.
    const close = pHashFromHex("fffe000000000000"); // 1 bit different at LSB of the 'f'
    const result = nearestBrand(close, { brands: TEST_BRANDS, threshold: 4 });
    expect(result!.brand.brand).toBe("TestPay");
    expect(result!.hammingDistance).toBeLessThan(4);
  });

  it("respects the threshold parameter", () => {
    const hash = pHashFromHex("ffff000000000005"); // 2 bits away from TestPay
    expect(nearestBrand(hash, { brands: TEST_BRANDS, threshold: 1 })).toBeNull();
    expect(nearestBrand(hash, { brands: TEST_BRANDS, threshold: 4 })).not.toBeNull();
  });
});

describe("isBrandSpoof", () => {
  const match = {
    brand: TEST_BRANDS[0]!,
    hammingDistance: 1,
    similarity: 0.98,
  };

  it("returns false when the hostname is the exact legitimate domain", () => {
    expect(isBrandSpoof(match, "testpay.example")).toBe(false);
  });

  it("returns false for a subdomain of a legitimate domain", () => {
    expect(isBrandSpoof(match, "login.testpay.example")).toBe(false);
  });

  it("returns true for a lookalike unrelated host", () => {
    expect(isBrandSpoof(match, "testpay-login.evil")).toBe(true);
    expect(isBrandSpoof(match, "test-pay.example")).toBe(true);
  });

  it("is case-insensitive on both sides", () => {
    expect(isBrandSpoof(match, "TESTPAY.EXAMPLE")).toBe(false);
  });
});

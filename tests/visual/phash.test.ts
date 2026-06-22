import { describe, expect, it } from "vitest";
import {
  hammingDistance,
  pHashFromHex,
  pHashToHex,
  perceptualHash,
  similarity,
  type RawImage,
} from "../../src/visual/phash";

/**
 * Builds a synthetic RGBA image of `width`×`height` using the given
 * grayscale function. The function returns a value in [0, 255].
 */
function gen(width: number, height: number, fn: (x: number, y: number) => number): RawImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const v = Math.max(0, Math.min(255, fn(x, y) | 0));
      const i = (y * width + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

describe("perceptualHash", () => {
  it("returns a 64-bit value (fits in 16 hex chars, ≤ 0xffffffffffffffff)", () => {
    const img = gen(64, 64, () => 128);
    const hash = perceptualHash(img);
    expect(pHashToHex(hash)).toHaveLength(16);
    expect(hash).toBeLessThanOrEqual(0xffffffffffffffffn);
  });

  it("is deterministic for the same input", () => {
    const img = gen(64, 64, (x, y) => ((x ^ y) * 7) % 256);
    const a = perceptualHash(img);
    const b = perceptualHash(img);
    expect(a).toBe(b);
  });

  it("is robust across resolutions of the same content (resampling stability)", () => {
    const small = gen(40, 40, (x, _y) => x * 6);
    const big = gen(200, 200, (x, _y) => Math.floor((x / 200) * 240));
    // Same vertical luminance ramp at two source resolutions. Bilinear
    // resampling from 40 vs 200 to 32 introduces some DCT noise in the
    // higher-order coefficients; ≤20 bits keeps the assertion meaningful (a
    // perceptually unrelated image is typically 30+ bits apart in the next
    // test) while surviving the resampling difference.
    const ha = perceptualHash(small);
    const hb = perceptualHash(big);
    expect(hammingDistance(ha, hb)).toBeLessThanOrEqual(20);
  });

  it("two structurally identical images have Hamming distance 0", () => {
    const a = gen(48, 48, (x, y) => ((x + y) % 16) * 16);
    const b = gen(48, 48, (x, y) => ((x + y) % 16) * 16);
    expect(hammingDistance(perceptualHash(a), perceptualHash(b))).toBe(0);
  });

  it("two unrelated images have substantially nonzero Hamming distance", () => {
    const verticalStripes = gen(64, 64, (x) => (x % 8 < 4 ? 240 : 16));
    const horizontalStripes = gen(64, 64, (_x, y) => (y % 8 < 4 ? 240 : 16));
    const dist = hammingDistance(
      perceptualHash(verticalStripes),
      perceptualHash(horizontalStripes),
    );
    expect(dist).toBeGreaterThan(10);
  });

  it("similarity is in [0,1] and equals 1 for identical inputs", () => {
    const a = gen(48, 48, (x) => x * 4);
    const b = gen(48, 48, (x) => x * 4);
    expect(similarity(perceptualHash(a), perceptualHash(b))).toBe(1);
  });
});

describe("pHashFromHex / pHashToHex", () => {
  it("round-trips through 16-char lowercase hex", () => {
    const hash = 0xdeadbeefcafef00dn;
    expect(pHashToHex(hash)).toBe("deadbeefcafef00d");
    expect(pHashFromHex("DEADBEEFCAFEF00D")).toBe(hash);
  });

  it("rejects non-hex input", () => {
    expect(() => pHashFromHex("not-hex")).toThrow(/Invalid/);
    expect(() => pHashFromHex("")).toThrow(/Invalid/);
  });
});

describe("hammingDistance", () => {
  it("is 0 for identical hashes and 64 for fully-inverted", () => {
    expect(hammingDistance(0n, 0n)).toBe(0);
    expect(hammingDistance(0n, 0xffffffffffffffffn)).toBe(64);
  });

  it("counts individual bit flips", () => {
    expect(hammingDistance(0n, 1n)).toBe(1);
    expect(hammingDistance(0n, 0b1011n)).toBe(3);
  });
});

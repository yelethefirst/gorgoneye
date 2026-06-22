/**
 * 64-bit perceptual hash (pHash) built on a 32→8 DCT.
 *
 * Algorithm:
 *   1. Reduce the input to grayscale.
 *   2. Bilinearly resize to 32×32.
 *   3. Apply a 2-D DCT-II.
 *   4. Keep the top-left 8×8 (the low-frequency components).
 *   5. Compute the median of those 64 values, excluding the DC coefficient
 *      (top-left), which dominates and would skew the median.
 *   6. Emit one bit per coefficient: 1 if > median, 0 otherwise. The
 *      resulting 64 bits are returned as a `bigint`.
 *
 * Two perceptually-similar images produce hashes whose Hamming distance is
 * small (typically ≤ 10). The matcher in `matcher.ts` enforces a threshold.
 *
 * The function accepts a minimal `RawImage` shape (raw RGBA pixel buffer)
 * so it can run in tests without a real DOM — happy-dom doesn't ship a
 * usable Canvas / OffscreenCanvas.
 */

export interface RawImage {
  /** Pixel width. */
  width: number;
  /** Pixel height. */
  height: number;
  /** RGBA byte buffer, `width * height * 4` bytes long. */
  data: Uint8ClampedArray | Uint8Array;
}

const PHASH_GRID = 32;
const PHASH_LOW = 8;

function toGrayscale(image: RawImage): Float64Array {
  const { width, height, data } = image;
  const out = new Float64Array(width * height);
  for (let i = 0; i < out.length; i += 1) {
    const r = data[i * 4]! / 255;
    const g = data[i * 4 + 1]! / 255;
    const b = data[i * 4 + 2]! / 255;
    // Rec. 601 luminance — close enough for hashing.
    out[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return out;
}

function bilinearResize(
  src: Float64Array,
  srcWidth: number,
  srcHeight: number,
  destSize: number,
): Float64Array {
  const out = new Float64Array(destSize * destSize);
  const xRatio = srcWidth > 1 ? (srcWidth - 1) / (destSize - 1) : 0;
  const yRatio = srcHeight > 1 ? (srcHeight - 1) / (destSize - 1) : 0;
  for (let y = 0; y < destSize; y += 1) {
    for (let x = 0; x < destSize; x += 1) {
      const gx = x * xRatio;
      const gy = y * yRatio;
      const gxi = Math.floor(gx);
      const gyi = Math.floor(gy);
      const dx = gx - gxi;
      const dy = gy - gyi;
      const gxn = Math.min(gxi + 1, srcWidth - 1);
      const gyn = Math.min(gyi + 1, srcHeight - 1);
      const c00 = src[gyi * srcWidth + gxi]!;
      const c10 = src[gyi * srcWidth + gxn]!;
      const c01 = src[gyn * srcWidth + gxi]!;
      const c11 = src[gyn * srcWidth + gxn]!;
      const top = c00 * (1 - dx) + c10 * dx;
      const bot = c01 * (1 - dx) + c11 * dx;
      out[y * destSize + x] = top * (1 - dy) + bot * dy;
    }
  }
  return out;
}

/** Precomputed DCT-II coefficient matrix for size N. */
function dctCoefficients(n: number): Float64Array {
  const out = new Float64Array(n * n);
  const sqrt2 = Math.sqrt(2);
  for (let k = 0; k < n; k += 1) {
    const factor = k === 0 ? 1 / Math.sqrt(n) : Math.sqrt(2 / n);
    for (let i = 0; i < n; i += 1) {
      // unused scaling consolidated into `factor`
      void sqrt2;
      out[k * n + i] = factor * Math.cos(((2 * i + 1) * k * Math.PI) / (2 * n));
    }
  }
  return out;
}

const DCT32 = dctCoefficients(PHASH_GRID);

function dct2d(input: Float64Array, n: number): Float64Array {
  const tmp = new Float64Array(n * n);
  // Rows
  for (let y = 0; y < n; y += 1) {
    for (let k = 0; k < n; k += 1) {
      let sum = 0;
      for (let x = 0; x < n; x += 1) {
        sum += input[y * n + x]! * DCT32[k * n + x]!;
      }
      tmp[y * n + k] = sum;
    }
  }
  // Columns
  const out = new Float64Array(n * n);
  for (let x = 0; x < n; x += 1) {
    for (let k = 0; k < n; k += 1) {
      let sum = 0;
      for (let y = 0; y < n; y += 1) {
        sum += tmp[y * n + x]! * DCT32[k * n + y]!;
      }
      out[k * n + x] = sum;
    }
  }
  return out;
}

/**
 * Computes a 64-bit perceptual hash of an RGBA image. Returns a `bigint`
 * whose low 64 bits carry the hash; bit 63 corresponds to the top-left
 * (after DC), bit 0 to the bottom-right of the low-frequency block.
 */
export function perceptualHash(image: RawImage): bigint {
  const gray = toGrayscale(image);
  const resized = bilinearResize(gray, image.width, image.height, PHASH_GRID);
  const dct = dct2d(resized, PHASH_GRID);

  const lowFreq = new Float64Array(PHASH_LOW * PHASH_LOW);
  for (let y = 0; y < PHASH_LOW; y += 1) {
    for (let x = 0; x < PHASH_LOW; x += 1) {
      lowFreq[y * PHASH_LOW + x] = dct[y * PHASH_GRID + x]!;
    }
  }

  // Median over the 63 values that exclude the DC coefficient (index 0).
  const sortable = Array.from(lowFreq.slice(1)).sort((a, b) => a - b);
  const mid = Math.floor(sortable.length / 2);
  const median =
    sortable.length % 2 === 0
      ? (sortable[mid - 1]! + sortable[mid]!) / 2
      : sortable[mid]!;

  let hash = 0n;
  for (let i = 0; i < 64; i += 1) {
    if (lowFreq[i]! > median) {
      hash |= 1n << BigInt(63 - i);
    }
  }
  return hash;
}

/** Convenience: hex-encode a 64-bit pHash (16 lowercase chars). */
export function pHashToHex(hash: bigint): string {
  return hash.toString(16).padStart(16, "0");
}

export function pHashFromHex(hex: string): bigint {
  const cleaned = hex.trim().toLowerCase();
  if (!/^[0-9a-f]{1,16}$/.test(cleaned)) {
    throw new Error(`Invalid pHash hex: ${hex}`);
  }
  return BigInt(`0x${cleaned}`);
}

/** Counts set bits in a 64-bit `bigint`. */
function popcount64(n: bigint): number {
  let v = n & 0xffffffffffffffffn;
  let count = 0;
  while (v > 0n) {
    count += Number(v & 1n);
    v >>= 1n;
  }
  return count;
}

/** Hamming distance between two 64-bit perceptual hashes. */
export function hammingDistance(a: bigint, b: bigint): number {
  return popcount64(a ^ b);
}

/**
 * Returns the similarity as a value in [0, 1]: 1 means identical pixels in
 * the low-frequency block, 0 means every bit flipped.
 */
export function similarity(a: bigint, b: bigint): number {
  return 1 - hammingDistance(a, b) / 64;
}

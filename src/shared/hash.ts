export function bytesToHex(bytes: Uint8Array): string {
  const out = new Array<string>(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    out[i] = bytes[i]!.toString(16).padStart(2, "0");
  }
  return out.join("");
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("hex string must have even length");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) throw new Error(`invalid hex digit at offset ${i * 2}`);
    out[i] = byte;
  }
  return out;
}

/**
 * Returns the SHA-256 digest of `input` as a 32-byte Uint8Array.
 * Uses the WebCrypto SubtleCrypto API; throws if SubtleCrypto is not available.
 */
export async function sha256(input: string): Promise<Uint8Array> {
  if (typeof globalThis.crypto?.subtle?.digest !== "function") {
    throw new Error("SHA-256 requires WebCrypto SubtleCrypto, which is not available in this runtime.");
  }
  const data = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(digest);
}

export async function sha256Hex(input: string): Promise<string> {
  return bytesToHex(await sha256(input));
}

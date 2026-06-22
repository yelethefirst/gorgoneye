import { bytesToHex, sha256 } from "../shared/hash";

export interface HashWithPrefix {
  /** Full 32-byte SHA-256 digest. */
  hash: Uint8Array;
  /** Hex representation of the full digest (64 chars). */
  hashHex: string;
  /** Leading `prefixBytes` bytes of the digest. Default 4 (matches Safe Browsing v4). */
  prefix: Uint8Array;
  /** Hex representation of the prefix. */
  prefixHex: string;
}

const DEFAULT_PREFIX_BYTES = 4;
const MIN_PREFIX_BYTES = 4;
const MAX_PREFIX_BYTES = 32;

/**
 * Hashes `input` with SHA-256 and returns both the full digest and a leading
 * `prefixBytes`-byte prefix. Safe Browsing v4 uses 4-byte prefixes by default;
 * larger prefixes (up to 32 = full hash) are allowed.
 *
 * Privacy note: this function does NOT send anything anywhere. The prefix is
 * the only fragment of a scanned URL that ever leaves the device, and only
 * when the threat-intel module (AEG-5-3) explicitly transmits it.
 */
export async function hashWithPrefix(
  input: string,
  prefixBytes: number = DEFAULT_PREFIX_BYTES,
): Promise<HashWithPrefix> {
  if (!Number.isInteger(prefixBytes)) {
    throw new Error(`prefixBytes must be an integer; got ${prefixBytes}`);
  }
  if (prefixBytes < MIN_PREFIX_BYTES || prefixBytes > MAX_PREFIX_BYTES) {
    throw new Error(
      `prefixBytes must be between ${MIN_PREFIX_BYTES} and ${MAX_PREFIX_BYTES}; got ${prefixBytes}`,
    );
  }
  const hash = await sha256(input);
  const prefix = hash.slice(0, prefixBytes);
  return {
    hash,
    hashHex: bytesToHex(hash),
    prefix,
    prefixHex: bytesToHex(prefix),
  };
}

/**
 * Returns `true` iff every byte of `prefix` matches the leading bytes of `hash`.
 * Used by the local prefix-database matcher.
 */
export function hashStartsWithPrefix(hash: Uint8Array, prefix: Uint8Array): boolean {
  if (prefix.length > hash.length) return false;
  for (let i = 0; i < prefix.length; i += 1) {
    if (hash[i] !== prefix[i]) return false;
  }
  return true;
}

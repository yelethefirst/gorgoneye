import { hammingDistance, similarity } from "./phash";
import { BRAND_DB, resolveBrands, type BrandEntry } from "./brandDb";

export interface BrandMatchResult {
  /** Brand that produced the smallest Hamming distance. */
  brand: BrandEntry;
  hammingDistance: number;
  similarity: number;
}

export interface MatchOptions {
  /** Maximum Hamming distance to consider a match. Default 10. */
  threshold?: number;
  /** Override the brand database. Defaults to the bundled `BRAND_DB`. */
  brands?: readonly BrandEntry[];
}

const DEFAULT_THRESHOLD = 10;

/**
 * Returns the nearest brand within the threshold, or `null` when no brand
 * matches closely enough. Comparison is over all brand entries; ties are
 * broken by insertion order in the brand DB.
 */
export function nearestBrand(
  imageHash: bigint,
  opts: MatchOptions = {},
): BrandMatchResult | null {
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const brands = resolveBrands(opts.brands ?? BRAND_DB);
  let best: BrandMatchResult | null = null;
  for (const brand of brands) {
    const distance = hammingDistance(imageHash, brand.pHash);
    if (distance > threshold) continue;
    if (best === null || distance < best.hammingDistance) {
      best = {
        brand,
        hammingDistance: distance,
        similarity: similarity(imageHash, brand.pHash),
      };
    }
  }
  return best;
}

/**
 * Decides whether a `BrandMatchResult` should count as a *spoof*: the URL's
 * hostname (or any suffix of it) must NOT match one of the brand's
 * legitimate domains. A login page on `paypal.com` rendering the PayPal
 * pHash is normal; the same hash on `paypa1.example/login` is a phishing
 * indicator.
 *
 * The host check mirrors the `makeIsTrusted` helper in the generic hover
 * scanner: exact match OR `hostname.endsWith("." + entry)`.
 */
export function isBrandSpoof(match: BrandMatchResult, hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  for (const entry of match.brand.legitimateDomains) {
    const e = entry.trim().toLowerCase();
    if (host === e) return false;
    if (host.endsWith("." + e)) return false;
  }
  return true;
}

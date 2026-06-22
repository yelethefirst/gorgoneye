import { pHashFromHex } from "./phash";

export interface BrandEntry {
  /** Display name. */
  brand: string;
  /** Hostnames or eTLD+1 values that legitimately serve this brand's login. */
  legitimateDomains: string[];
  /** Hex-encoded 64-bit pHash of the brand's login page screenshot. */
  pHashHex: string;
  /** ISO date the hash was captured (or recomputed). */
  capturedAt: string;
  /** Free-form note about the capture (resolution, route, redactions, etc.). */
  captureNotes: string;
}

/**
 * Seed brand-hash database. Values are intentionally synthetic — they are
 * captured from deterministic test images so the matching layer can be
 * exercised end-to-end without depending on screenshots of real brand
 * websites. Real captures land via the offscreen pipeline in AEG-6-1.
 *
 * Production deployments will replace this with a signed brand bundle.
 */
export const BRAND_DB: readonly BrandEntry[] = [
  {
    brand: "PayPal",
    legitimateDomains: ["paypal.com"],
    pHashHex: "ffff000000000000",
    capturedAt: "2026-06-01",
    captureNotes:
      "Synthetic test capture: top half white, bottom half black. Replaced by a real screenshot when AEG-6-1 lands.",
  },
  {
    brand: "Microsoft 365",
    legitimateDomains: ["microsoft.com", "office.com", "office365.com", "live.com"],
    pHashHex: "ff00ff00ff00ff00",
    capturedAt: "2026-06-01",
    captureNotes:
      "Synthetic test capture: horizontal stripes alternating white/black. Replaced by a real capture later.",
  },
  {
    brand: "Google",
    legitimateDomains: ["google.com", "gmail.com", "youtube.com"],
    pHashHex: "aaaaaaaaaaaaaaaa",
    capturedAt: "2026-06-01",
    captureNotes:
      "Synthetic test capture: vertical stripes. Replaced by a real capture later.",
  },
];

/** Pre-parsed pHashes for fast Hamming distance. */
export interface ResolvedBrand extends BrandEntry {
  pHash: bigint;
}

export function resolveBrands(db: readonly BrandEntry[] = BRAND_DB): ResolvedBrand[] {
  return db.map((entry) => ({ ...entry, pHash: pHashFromHex(entry.pHashHex) }));
}

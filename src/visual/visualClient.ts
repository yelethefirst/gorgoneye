import type { ParsedUrl } from "../shared/parsedUrl";
import type { VisualResult } from "../shared/verdict";
import { perceptualHash, type RawImage } from "./phash";
import { isBrandSpoof, nearestBrand, type MatchOptions } from "./matcher";

/**
 * Source of pixel data for the visual layer.
 *
 * Implementations:
 *   - `FixtureImageSource` (this file)  — for tests and the demo. Hands a
 *     pre-computed `RawImage` straight to the pipeline.
 *   - `OffscreenImageSource` (AEG-6-1) — fetches the URL in a consent-gated
 *     offscreen document, renders it to a canvas, returns the pixels.
 *
 * The source is the only seam where remote-origin contact can happen. The
 * VisualClient itself is pure code.
 */
export interface ImageSource {
  /**
   * Returns the pixel buffer for the given URL. MUST resolve quickly or
   * throw; long-running fetches block fusion. Returns `null` if the source
   * cannot service this URL (e.g. consent was declined, or no fixture
   * registered for this domain).
   */
  imageFor(parsed: ParsedUrl): Promise<RawImage | null>;
}

export interface VisualClientOptions {
  source: ImageSource;
  matchOptions?: MatchOptions;
  /** Inject for deterministic timings in tests. Defaults to performance.now. */
  now?: () => number;
}

function performanceNow(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

/**
 * High-level visual-inspection client. Given a `ParsedUrl`, it asks its
 * `ImageSource` for pixels, computes a perceptual hash, and looks up the
 * nearest brand in the local DB. A close match against a brand whose
 * legitimate domain DOES NOT cover this URL's hostname is a brand-spoof
 * signal.
 *
 * Privacy: this client never transmits the URL or the image. The only
 * surface where a remote origin can be touched is the `ImageSource`, and
 * that is consent-gated separately (see ADR-0013).
 */
export class VisualClient {
  private readonly now: () => number;

  constructor(private readonly opts: VisualClientOptions) {
    this.now = opts.now ?? performanceNow;
  }

  async inspect(parsed: ParsedUrl): Promise<VisualResult> {
    const start = this.now();

    if (parsed.parseError) {
      return {
        layer: "visual",
        status: "unavailable",
        consentRequired: true,
        targetOriginContacted: false,
        error: `URL did not parse (${parsed.parseError}); skipping visual inspection.`,
        durationMs: this.now() - start,
      };
    }

    let image: RawImage | null;
    try {
      image = await this.opts.source.imageFor(parsed);
    } catch (err) {
      return {
        layer: "visual",
        status: "error",
        consentRequired: true,
        targetOriginContacted: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: this.now() - start,
      };
    }

    if (image === null) {
      return {
        layer: "visual",
        status: "not_requested",
        consentRequired: true,
        targetOriginContacted: false,
        durationMs: this.now() - start,
      };
    }

    const hash = perceptualHash(image);
    const match = nearestBrand(hash, this.opts.matchOptions);

    if (!match) {
      return {
        layer: "visual",
        status: "complete",
        consentRequired: false,
        targetOriginContacted: true,
        durationMs: this.now() - start,
      };
    }

    const spoof = isBrandSpoof(match, parsed.hostname ?? "");
    return {
      layer: "visual",
      status: "complete",
      consentRequired: false,
      targetOriginContacted: true,
      matchedBrand: match.brand.brand,
      legitimateDomains: [...match.brand.legitimateDomains],
      hammingDistance: match.hammingDistance,
      similarity: match.similarity,
      score: spoof ? match.similarity : 0,
      durationMs: this.now() - start,
    };
  }
}

/**
 * Trivial `ImageSource` that returns a pre-registered `RawImage` for an
 * exact hostname. Used by the privacy verifier and unit tests; the demo can
 * also use it with a local PNG decoded into a `RawImage`.
 */
export class FixtureImageSource implements ImageSource {
  private readonly map: Map<string, RawImage>;
  constructor(entries: Record<string, RawImage>) {
    this.map = new Map(Object.entries(entries));
  }
  async imageFor(parsed: ParsedUrl): Promise<RawImage | null> {
    const host = parsed.hostname;
    if (!host) return null;
    return this.map.get(host) ?? null;
  }
}

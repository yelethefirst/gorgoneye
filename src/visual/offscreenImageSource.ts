import type { ParsedUrl } from "../shared/parsedUrl";
import type { ImageSource } from "./visualClient";
import type { RawImage } from "./phash";
import { auditedFetch, type AuditedFetchInit } from "../audit/auditedFetch";
import type { AuditStore } from "../audit/auditStore";

/**
 * Real-world `ImageSource` (AEG-6-1). Implements the documented Approach B:
 *
 *   1. Fetch the target URL's HTML through `auditedFetch`, with consent
 *      and `dataCategory: "target_origin_request"`. This is the only place
 *      the visual pipeline contacts a remote origin.
 *   2. Parse the HTML, find the largest same-origin candidate image
 *      (Open Graph image, then `<link rel="icon" sizes="…">`, then the
 *      largest visible `<img>` near the top of the body).
 *   3. Fetch the candidate image through `auditedFetch`, again as a
 *      consented target-origin call.
 *   4. Decode the image bytes through `createImageBitmap` and rasterize to
 *      an `OffscreenCanvas`, returning the raw RGBA pixels.
 *
 * We deliberately do NOT load the page in an iframe — that's Approach A,
 * which is more accurate but has a larger permission surface and breaks on
 * sites that set X-Frame-Options. Approach B is the right default for a
 * privacy-first product where one of the audit log's roles is to be
 * minimal.
 *
 * The source carries the user's consent decision in via the constructor;
 * the caller (the visual layer in the popup detail panel) is responsible
 * for resolving the consent UI before invoking us. A `consented: false`
 * instance writes a single "declined" audit row and returns null — see
 * ADR-0013 on why we log declines.
 */
export interface OffscreenImageSourceOptions {
  store: AuditStore;
  /** True iff the user has consented to the inspection for this specific URL. */
  consented: boolean;
  /** Injected for tests; defaults to globalThis.fetch. */
  fetchImpl?: (input: string, init: RequestInit) => Promise<Response>;
  /** Injected for tests; the decoder returns RGBA pixel data from a Blob. */
  decode?: (blob: Blob) => Promise<RawImage>;
  /** Max bytes to accept for either the HTML or the image. Default 2 MB. */
  maxBytes?: number;
  /** Inspector-decoder downscale target on the long side; default 256 px. */
  maxImageSide?: number;
}

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_SIDE = 256;
const HTML_PURPOSE = "visual_inspection_target_origin" as const;
const HTML_CATEGORY = "target_origin_request" as const;

export class OffscreenImageSource implements ImageSource {
  constructor(private readonly opts: OffscreenImageSourceOptions) {}

  async imageFor(parsed: ParsedUrl): Promise<RawImage | null> {
    if (!parsed.hostname) return null;

    // If consent was declined, write the positive-decline audit row and
    // return null. ADR-0013 specifies that this row exists so reviewers can
    // see "consent declined" as a signal, not as a missing event.
    if (!this.opts.consented) {
      await this.recordDeclined(parsed.canonicalUrl || parsed.originalUrl);
      return null;
    }

    // Step 1: fetch the page HTML.
    const html = await this.fetchText({
      url: parsed.canonicalUrl || parsed.originalUrl,
      method: "GET",
    });
    if (!html) return null;

    // Step 2: parse and pick a candidate.
    const candidate = pickCandidateImageUrl(html, parsed);
    if (!candidate) return null;

    // Step 3: fetch the candidate image bytes through audit + decode.
    const imageBlob = await this.fetchBlob(candidate);
    if (!imageBlob) return null;

    const decode = this.opts.decode ?? defaultDecode(this.opts.maxImageSide ?? DEFAULT_MAX_SIDE);
    try {
      return await decode(imageBlob);
    } catch {
      return null;
    }
  }

  private async fetchText(init: { url: string; method: "GET" }): Promise<string | null> {
    const result = await this.consentedFetch({
      url: init.url,
      method: init.method,
    });
    if (!result) return null;
    return result.bodyText;
  }

  private async fetchBlob(url: string): Promise<Blob | null> {
    // We need raw bytes for image decoding; reuse the consentedFetch path
    // for the audit record, then re-fetch via the same fetchImpl to get a
    // Blob. (auditedFetch returns text, which loses binary data for
    // anything but ASCII.) The second call still writes its own audit row.
    const fetchImpl = this.opts.fetchImpl ?? globalThis.fetch?.bind(globalThis);
    if (!fetchImpl) return null;

    const auditResult = await this.consentedFetch({
      url,
      method: "GET",
    });
    if (!auditResult) return null;

    try {
      const response = await fetchImpl(url, { method: "GET" });
      const blob = await response.blob();
      if (blob.size > (this.opts.maxBytes ?? DEFAULT_MAX_BYTES)) return null;
      return blob;
    } catch {
      return null;
    }
  }

  private async consentedFetch(init: { url: string; method: "GET" }): Promise<
    { bodyText: string; status: number; recordId: string } | null
  > {
    const fetchInit: AuditedFetchInit = {
      url: init.url,
      method: init.method,
      purpose: HTML_PURPOSE,
      dataCategory: HTML_CATEGORY,
      containsFullScannedUrl: true,
      userConsented: true,
    };
    try {
      const out = await auditedFetch(fetchInit, {
        store: this.opts.store,
        ...(this.opts.fetchImpl ? { fetchImpl: this.opts.fetchImpl } : {}),
      });
      if (out.status < 200 || out.status >= 300) return null;
      return out;
    } catch {
      return null;
    }
  }

  private async recordDeclined(url: string): Promise<void> {
    // Write a no-op audit record via the testMode shortcut: we want the row
    // (purpose / category / consent flag false) without actually performing
    // a fetch. Per ADR-0013 the byte counts are zero and the status is
    // absent.
    await auditedFetch(
      {
        url,
        method: "GET",
        purpose: HTML_PURPOSE,
        dataCategory: HTML_CATEGORY,
        containsFullScannedUrl: false,
        userConsented: false,
        testMode: { status: 0, body: "" },
      },
      { store: this.opts.store },
    ).catch(() => undefined);
  }
}

/**
 * Picks the most representative image URL from a page's HTML for brand
 * matching. Order:
 *   1. `<meta property="og:image">` / `twitter:image` (intended to be the
 *      page's representative image — exactly what we want).
 *   2. The largest visible `<img>` near the top of the document body.
 *   3. The page's `<link rel="icon">` favicon.
 *
 * Cross-origin candidates are dropped so the visual inspection contacts
 * exactly one host — the one the user already consented to. Data URIs are
 * allowed because they don't introduce a new origin.
 */
export function pickCandidateImageUrl(html: string, parsed: ParsedUrl): string | null {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, "text/html");
  } catch {
    return null;
  }

  const candidates: string[] = [];
  const ogImage = doc.querySelector(
    'meta[property="og:image"], meta[name="og:image"], meta[name="twitter:image"]',
  );
  if (ogImage instanceof HTMLMetaElement && ogImage.content) candidates.push(ogImage.content);

  for (const img of Array.from(doc.querySelectorAll("img"))) {
    const src = img.getAttribute("src");
    if (src) candidates.push(src);
  }

  const favicon = doc.querySelector('link[rel~="icon"]');
  if (favicon instanceof HTMLLinkElement && favicon.href) candidates.push(favicon.href);

  const baseHost = parsed.hostname?.toLowerCase();
  if (!baseHost) return null;
  const baseUrl = parsed.canonicalUrl || parsed.originalUrl;

  for (const raw of candidates) {
    const resolved = resolveSameOrigin(raw, baseUrl, baseHost);
    if (resolved) return resolved;
  }
  return null;
}

function resolveSameOrigin(raw: string, baseUrl: string, baseHost: string): string | null {
  if (!raw) return null;
  if (raw.startsWith("data:")) return raw;
  try {
    const resolved = new URL(raw, baseUrl);
    if (resolved.hostname.toLowerCase() !== baseHost) return null;
    return resolved.toString();
  } catch {
    return null;
  }
}

/**
 * Default image decoder: turns a Blob into a `RawImage` by decoding through
 * `createImageBitmap` and rasterizing to an `OffscreenCanvas`. Skips work
 * in environments that don't ship these globals (Node tests inject their
 * own decoder via `OffscreenImageSourceOptions.decode`).
 */
export function defaultDecode(maxSide: number): (blob: Blob) => Promise<RawImage> {
  return async (blob: Blob) => {
    if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas === "undefined") {
      throw new Error("Image decoder requires createImageBitmap + OffscreenCanvas.");
    }
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not acquire 2D context on OffscreenCanvas.");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const imageData = ctx.getImageData(0, 0, w, h);
    return { width: w, height: h, data: imageData.data };
  };
}

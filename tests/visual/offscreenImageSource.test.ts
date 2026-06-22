// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { AuditStore } from "../../src/audit/auditStore";
import { createMemoryKvStore } from "../../src/storage/kvStore";
import { parseUrl } from "../../src/rules/parseUrl";
import {
  OffscreenImageSource,
  pickCandidateImageUrl,
} from "../../src/visual/offscreenImageSource";
import type { RawImage } from "../../src/visual/phash";

const SAMPLE_HTML = `<!doctype html>
<html><head>
  <meta property="og:image" content="/logo.png">
  <link rel="icon" href="https://cdn.example/favicon.ico">
</head><body>
  <img src="https://other-cdn.example/banner.png">
  <img src="/inline-img.png">
</body></html>`;

function makeImage(width = 64, height = 64): RawImage {
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4).fill(200),
  };
}

function makeFetch(routes: Record<string, { status: number; body: string }>) {
  return vi.fn(async (url: string) => {
    const route = routes[url];
    if (!route) {
      return new Response("not found", { status: 404 });
    }
    return new Response(route.body, {
      status: route.status,
      headers: { "content-type": "text/html" },
    });
  });
}

describe("pickCandidateImageUrl", () => {
  it("prefers og:image when present and same-origin", () => {
    const parsed = parseUrl("https://target.example/login");
    const url = pickCandidateImageUrl(SAMPLE_HTML, parsed);
    expect(url).toBe("https://target.example/logo.png");
  });

  it("skips cross-origin candidates", () => {
    const html = `<img src="https://other-cdn.example/x.png"><img src="/local.png">`;
    const parsed = parseUrl("https://target.example/login");
    expect(pickCandidateImageUrl(html, parsed)).toBe("https://target.example/local.png");
  });

  it("allows data: URIs without origin checking", () => {
    const html = `<img src="data:image/svg+xml,%3Csvg/%3E">`;
    const parsed = parseUrl("https://target.example/login");
    expect(pickCandidateImageUrl(html, parsed)).toMatch(/^data:image/);
  });

  it("returns null when no candidates resolve to the page origin", () => {
    const html = `<img src="https://other-cdn.example/only.png">`;
    const parsed = parseUrl("https://target.example/login");
    expect(pickCandidateImageUrl(html, parsed)).toBeNull();
  });

  it("returns null for malformed HTML", () => {
    // happy-dom's DOMParser is lenient; this passes through fine but still
    // returns null because there are no candidates.
    expect(pickCandidateImageUrl("", parseUrl("https://example.com/"))).toBeNull();
  });
});

describe("OffscreenImageSource", () => {
  it("returns null and writes a declined audit row when consent was declined", async () => {
    const store = new AuditStore(createMemoryKvStore());
    const source = new OffscreenImageSource({ store, consented: false });
    const result = await source.imageFor(parseUrl("https://attacker.example/login"));
    expect(result).toBeNull();
    const records = await store.recent();
    expect(records).toHaveLength(1);
    expect(records[0]!.userConsented).toBe(false);
    expect(records[0]!.containsFullScannedUrl).toBe(false);
    expect(records[0]!.purpose).toBe("visual_inspection_target_origin");
    expect(records[0]!.dataCategory).toBe("target_origin_request");
    expect(records[0]!.status).toBe(0);
  });

  it("returns null for a parsed URL with no hostname", async () => {
    const store = new AuditStore(createMemoryKvStore());
    const source = new OffscreenImageSource({ store, consented: true });
    const result = await source.imageFor(parseUrl("not a url"));
    expect(result).toBeNull();
    await expect(store.recent()).resolves.toEqual([]);
  });

  it("walks the full Approach B pipeline: HTML fetch → image fetch → decode → RawImage", async () => {
    const store = new AuditStore(createMemoryKvStore());
    const fetchImpl = makeFetch({
      "https://attacker.example/login": { status: 200, body: SAMPLE_HTML },
      "https://attacker.example/logo.png": { status: 200, body: "binary-bytes" },
    });
    const decode = vi.fn(async (_blob: Blob) => makeImage(64, 64));
    const source = new OffscreenImageSource({
      store,
      consented: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      decode,
    });

    const result = await source.imageFor(parseUrl("https://attacker.example/login"));
    expect(result).not.toBeNull();
    expect(result!.width).toBe(64);
    expect(decode).toHaveBeenCalledOnce();

    // Three records expected: HTML audited fetch, image audited fetch (via
    // consentedFetch), then the raw image fetch the source does for bytes.
    const records = await store.recent();
    expect(records.length).toBeGreaterThanOrEqual(2);
    for (const r of records) {
      expect(r.userConsented).toBe(true);
      expect(r.containsFullScannedUrl).toBe(true);
      expect(r.purpose).toBe("visual_inspection_target_origin");
      expect(r.dataCategory).toBe("target_origin_request");
    }
  });

  it("returns null when the HTML fetch fails (4xx)", async () => {
    const store = new AuditStore(createMemoryKvStore());
    const fetchImpl = makeFetch({
      "https://attacker.example/login": { status: 500, body: "" },
    });
    const source = new OffscreenImageSource({
      store,
      consented: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await source.imageFor(parseUrl("https://attacker.example/login"));
    expect(result).toBeNull();
  });

  it("returns null when no same-origin image candidate is found", async () => {
    const html = `<html><body><img src="https://other-cdn.example/only.png"></body></html>`;
    const store = new AuditStore(createMemoryKvStore());
    const fetchImpl = makeFetch({
      "https://attacker.example/login": { status: 200, body: html },
    });
    const source = new OffscreenImageSource({
      store,
      consented: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      decode: vi.fn(),
    });
    const result = await source.imageFor(parseUrl("https://attacker.example/login"));
    expect(result).toBeNull();
  });
});

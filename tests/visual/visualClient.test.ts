import { describe, expect, it } from "vitest";
import { FixtureImageSource, VisualClient } from "../../src/visual/visualClient";
import { parseUrl } from "../../src/rules/parseUrl";
import type { BrandEntry } from "../../src/visual/brandDb";
import { perceptualHash, pHashToHex, type RawImage } from "../../src/visual/phash";

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

// Deterministic "PayPal-like" pattern. The test brand DB below uses the
// exact pHash of this image, so a hostname that isn't paypal.com renders
// the same image → confirmed spoof.
const PAYPAL_FIXTURE = gen(64, 64, (x, y) => (y < 32 ? 240 : 16));
const PAYPAL_PHASH_HEX = pHashToHex(perceptualHash(PAYPAL_FIXTURE));

const TEST_BRANDS: BrandEntry[] = [
  {
    brand: "PayPal",
    legitimateDomains: ["paypal.com"],
    pHashHex: PAYPAL_PHASH_HEX,
    capturedAt: "2026-06-01",
    captureNotes: "test fixture",
  },
];

describe("VisualClient.inspect", () => {
  it("returns status=not_requested when the source has no image for the host", async () => {
    const client = new VisualClient({ source: new FixtureImageSource({}) });
    const result = await client.inspect(parseUrl("https://nothing.example/"));
    expect(result.status).toBe("not_requested");
    expect(result.targetOriginContacted).toBe(false);
  });

  it("returns status=unavailable for a URL that did not parse", async () => {
    const client = new VisualClient({ source: new FixtureImageSource({}) });
    const result = await client.inspect(parseUrl("not a url"));
    expect(result.status).toBe("unavailable");
    expect(result.error).toMatch(/did not parse/i);
  });

  it("returns status=complete with no brand match when the image doesn't look like any brand", async () => {
    const noisy = gen(64, 64, (x, y) => ((x * 13 + y * 7) % 251));
    const client = new VisualClient({
      source: new FixtureImageSource({ "random.example": noisy }),
      matchOptions: { brands: TEST_BRANDS, threshold: 4 },
    });
    const result = await client.inspect(parseUrl("https://random.example/"));
    expect(result.status).toBe("complete");
    expect(result.matchedBrand).toBeUndefined();
    expect(result.targetOriginContacted).toBe(true);
  });

  it("confirms a brand spoof when the image matches a brand but the hostname does not", async () => {
    const client = new VisualClient({
      source: new FixtureImageSource({ "paypa1.example": PAYPAL_FIXTURE }),
      matchOptions: { brands: TEST_BRANDS, threshold: 4 },
    });
    const result = await client.inspect(parseUrl("https://paypa1.example/login"));
    expect(result.status).toBe("complete");
    expect(result.matchedBrand).toBe("PayPal");
    expect(result.legitimateDomains).toEqual(["paypal.com"]);
    expect(result.hammingDistance).toBe(0);
    expect(result.similarity).toBe(1);
    expect(result.score).toBe(1);
    expect(result.targetOriginContacted).toBe(true);
  });

  it("does NOT confirm a spoof when the image matches a brand AND the hostname is legitimate", async () => {
    const client = new VisualClient({
      source: new FixtureImageSource({ "paypal.com": PAYPAL_FIXTURE }),
      matchOptions: { brands: TEST_BRANDS, threshold: 4 },
    });
    const result = await client.inspect(parseUrl("https://paypal.com/signin"));
    expect(result.status).toBe("complete");
    expect(result.matchedBrand).toBe("PayPal");
    expect(result.score).toBe(0); // matched but legitimate → no fusion contribution
  });

  it("returns status=error when the source throws", async () => {
    const throwingSource = {
      async imageFor() {
        throw new Error("simulated fetch failure");
      },
    };
    const client = new VisualClient({ source: throwingSource });
    const result = await client.inspect(parseUrl("https://example.com/"));
    expect(result.status).toBe("error");
    expect(result.error).toMatch(/simulated/);
  });
});

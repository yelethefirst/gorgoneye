import { describe, expect, it } from "vitest";
import { analyzeUrl } from "../../src/detection/analyzeUrl";
import { FixtureImageSource, VisualClient } from "../../src/visual/visualClient";
import { perceptualHash, pHashToHex, type RawImage } from "../../src/visual/phash";
import type { BrandEntry } from "../../src/visual/brandDb";

const ctx = { surface: "test_fixture" as const, userGesture: "manual_scan" as const };

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

const PAYPAL_FIXTURE = gen(64, 64, (x, y) => (y < 32 ? 240 : 16));
const TEST_BRANDS: BrandEntry[] = [
  {
    brand: "PayPal",
    legitimateDomains: ["paypal.com"],
    pHashHex: pHashToHex(perceptualHash(PAYPAL_FIXTURE)),
    capturedAt: "2026-06-01",
    captureNotes: "test fixture",
  },
];

describe("analyzeUrl + visual layer (AEG-6-4)", () => {
  it("without a visual client: visual is in unavailableLayers", async () => {
    const result = await analyzeUrl({
      url: "https://paypa1.example/login",
      context: ctx,
    });
    expect(result.layers.visual).toBeUndefined();
    const reasons = result.unavailableLayers
      .filter((u) => u.layer === "visual")
      .map((u) => u.reason);
    expect(reasons[0]).toMatch(/consent/i);
  });

  it("with a confirmed brand spoof: verdict elevates to phishing, signal fires, targetOriginContacted=true", async () => {
    const client = new VisualClient({
      source: new FixtureImageSource({ "paypa1.example": PAYPAL_FIXTURE }),
      matchOptions: { brands: TEST_BRANDS, threshold: 4 },
    });
    const baseline = await analyzeUrl({
      url: "https://paypa1.example/login",
      context: ctx,
    });
    const withVisual = await analyzeUrl({
      url: "https://paypa1.example/login",
      context: ctx,
      visual: client,
    });

    expect(withVisual.layers.visual?.matchedBrand).toBe("PayPal");
    expect(withVisual.confidence).toBeGreaterThan(baseline.confidence);
    expect(withVisual.verdict).toBe("phishing");
    expect(withVisual.privacy.targetOriginContacted).toBe(true);
    const visualSignal = withVisual.firedSignals.find((s) => s.layer === "visual");
    expect(visualSignal).toBeDefined();
    expect(visualSignal!.severity).toBe("high");
  });

  it("legitimate brand domain rendering the matching image adds NO visual fusion contribution", async () => {
    const client = new VisualClient({
      source: new FixtureImageSource({ "paypal.com": PAYPAL_FIXTURE }),
      matchOptions: { brands: TEST_BRANDS, threshold: 4 },
    });
    const baseline = await analyzeUrl({ url: "https://paypal.com/signin", context: ctx });
    const result = await analyzeUrl({
      url: "https://paypal.com/signin",
      context: ctx,
      visual: client,
    });
    expect(result.layers.visual?.matchedBrand).toBe("PayPal");
    // No visual signal fires; confidence + verdict equal the rules-only
    // baseline (which is "suspicious" thanks to the credential keyword in
    // /signin).
    expect(result.firedSignals.some((s) => s.layer === "visual")).toBe(false);
    expect(result.confidence).toBeCloseTo(baseline.confidence, 4);
    expect(result.verdict).toBe(baseline.verdict);
  });

  it("unrelated image on unrelated host: no signal, no fusion contribution", async () => {
    const noise = gen(64, 64, (x, y) => ((x * 17 + y * 31) % 199));
    const client = new VisualClient({
      source: new FixtureImageSource({ "example.com": noise }),
      matchOptions: { brands: TEST_BRANDS, threshold: 4 },
    });
    const result = await analyzeUrl({
      url: "https://example.com/login",
      context: ctx,
      visual: client,
    });
    expect(result.layers.visual?.matchedBrand).toBeUndefined();
    expect(result.firedSignals.some((s) => s.layer === "visual")).toBe(false);
  });

  it("visual source that throws does not crash analysis; status=error reported", async () => {
    const client = new VisualClient({
      source: {
        async imageFor() {
          throw new Error("offscreen failure");
        },
      },
    });
    const result = await analyzeUrl({
      url: "https://example.com/",
      context: ctx,
      visual: client,
    });
    expect(result.layers.visual?.status).toBe("error");
    // Missing visual never counts as safe; verdict from rules alone.
    expect(result.verdict).toBe("safe");
  });
});

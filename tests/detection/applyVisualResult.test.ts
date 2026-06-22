import { describe, expect, it } from "vitest";
import { analyzeUrl } from "../../src/detection/analyzeUrl";
import { applyVisualResult } from "../../src/detection/applyVisualResult";
import type { VisualResult } from "../../src/shared/verdict";

const ctx = { surface: "test_fixture" as const, userGesture: "manual_scan" as const };

describe("applyVisualResult (AEG-6-1 consent-gated re-fusion)", () => {
  it("a confirmed brand spoof elevates the verdict and adds a visual signal", async () => {
    const baseline = await analyzeUrl({
      url: "https://paypa1.example/login",
      context: ctx,
    });
    expect(baseline.firedSignals.some((s) => s.layer === "visual")).toBe(false);

    const spoof: VisualResult = {
      layer: "visual",
      status: "complete",
      consentRequired: false,
      targetOriginContacted: true,
      matchedBrand: "PayPal",
      legitimateDomains: ["paypal.com"],
      hammingDistance: 2,
      similarity: 0.97,
      score: 0.97,
      durationMs: 41,
    };
    const updated = applyVisualResult(baseline, spoof);

    expect(updated.layers.visual).toBe(spoof);
    expect(updated.confidence).toBeGreaterThan(baseline.confidence);
    expect(updated.verdict).toBe("phishing");
    expect(updated.privacy.targetOriginContacted).toBe(true);
    const visualSignal = updated.firedSignals.find((s) => s.layer === "visual");
    expect(visualSignal?.severity).toBe("high");
    expect(visualSignal?.title).toContain("PayPal");
    // The analysis ID is preserved so the popup can keep its selection.
    expect(updated.analysisId).toBe(baseline.analysisId);
  });

  it("a no-match visual result fuses with score 0 — verdict and signal list unchanged", async () => {
    const baseline = await analyzeUrl({
      url: "https://example.com/account",
      context: ctx,
    });
    const noMatch: VisualResult = {
      layer: "visual",
      status: "complete",
      consentRequired: false,
      targetOriginContacted: true,
      durationMs: 12,
    };
    const updated = applyVisualResult(baseline, noMatch);
    expect(updated.layers.visual).toBe(noMatch);
    expect(updated.verdict).toBe(baseline.verdict);
    expect(updated.firedSignals.some((s) => s.layer === "visual")).toBe(false);
    expect(updated.privacy.targetOriginContacted).toBe(true);
  });

  it("re-applying a fresh visual result replaces (not duplicates) the prior visual signal", async () => {
    const baseline = await analyzeUrl({
      url: "https://paypa1.example/login",
      context: ctx,
    });
    const spoofA: VisualResult = {
      layer: "visual",
      status: "complete",
      consentRequired: false,
      targetOriginContacted: true,
      matchedBrand: "PayPal",
      legitimateDomains: ["paypal.com"],
      hammingDistance: 3,
      similarity: 0.95,
      score: 0.95,
      durationMs: 50,
    };
    const once = applyVisualResult(baseline, spoofA);
    const twice = applyVisualResult(once, spoofA);
    const visualSignals = twice.firedSignals.filter((s) => s.layer === "visual");
    expect(visualSignals).toHaveLength(1);
  });

  it("a declined / not-requested result does not add a visual signal but is recorded in layers", async () => {
    const baseline = await analyzeUrl({
      url: "https://paypa1.example/login",
      context: ctx,
    });
    const declined: VisualResult = {
      layer: "visual",
      status: "not_requested",
      consentRequired: true,
      targetOriginContacted: false,
      durationMs: 0,
    };
    const updated = applyVisualResult(baseline, declined);
    expect(updated.layers.visual).toBe(declined);
    expect(updated.firedSignals.some((s) => s.layer === "visual")).toBe(false);
    expect(updated.confidence).toBeCloseTo(baseline.confidence, 6);
    expect(updated.privacy.targetOriginContacted).toBe(false);
  });

  it("removes the prior 'visual unavailable' entry once a real result has been folded in", async () => {
    const baseline = await analyzeUrl({
      url: "https://example.com/account",
      context: ctx,
    });
    expect(baseline.unavailableLayers.some((u) => u.layer === "visual")).toBe(true);
    const noMatch: VisualResult = {
      layer: "visual",
      status: "complete",
      consentRequired: false,
      targetOriginContacted: true,
      durationMs: 8,
    };
    const updated = applyVisualResult(baseline, noMatch);
    expect(updated.unavailableLayers.some((u) => u.layer === "visual")).toBe(false);
  });
});

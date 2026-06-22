import { describe, expect, it } from "vitest";
import { analyzeUrl, disabledAnalysis } from "../../src/detection/analyzeUrl";

describe("disabledAnalysis", () => {
  it("returns an unknown verdict with zero confidence and no rules", async () => {
    const result = await disabledAnalysis({
      url: "https://paypa1.example/verify",
      context: { surface: "popup_manual_scan", userGesture: "manual_scan" },
    });

    expect(result.verdict).toBe("unknown");
    expect(result.confidence).toBe(0);
    expect(result.layers.rules.signals).toHaveLength(0);
    expect(result.firedSignals).toHaveLength(0);
  });

  it("lists the rules layer as unavailable with a disabled-protection reason", async () => {
    const result = await disabledAnalysis({
      url: "https://example.com",
      context: { surface: "popup_manual_scan", userGesture: "manual_scan" },
    });
    const reasons = result.unavailableLayers.map((u) => `${u.layer}:${u.reason}`);
    expect(reasons.some((r) => r.startsWith("rules:") && /disabled/i.test(r))).toBe(true);
  });

  it("keeps the privacy summary intact (no data leaves device)", async () => {
    const result = await disabledAnalysis({
      url: "https://example.com",
      context: { surface: "popup_manual_scan", userGesture: "manual_scan" },
    });
    expect(result.privacy.emailContentLeftDevice).toBe(false);
    expect(result.privacy.fullUrlSentToThreatIntel).toBe(false);
    expect(result.privacy.telemetrySent).toBe(false);
  });

  it("differs from analyzeUrl which would fire signals on the same URL", async () => {
    const args = {
      url: "https://paypa1.example/verify",
      context: { surface: "popup_manual_scan" as const, userGesture: "manual_scan" as const },
    };
    const enabled = await analyzeUrl(args);
    const disabled = await disabledAnalysis(args);
    expect(enabled.firedSignals.length).toBeGreaterThan(0);
    expect(disabled.firedSignals.length).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { summarizeVerdicts } from "../../src/ui/popupSummary";
import { analyzeUrl, disabledAnalysis } from "../../src/detection/analyzeUrl";

describe("summarizeVerdicts", () => {
  it("returns zeroed counts for an empty list", () => {
    expect(summarizeVerdicts([])).toEqual({
      total: 0,
      safe: 0,
      suspicious: 0,
      phishing: 0,
      unknown: 0,
    });
  });

  it("counts verdicts by category across a mixed list", async () => {
    const safe = await analyzeUrl({
      url: "https://github.com/aegishield/aegis-gorgon",
      context: { surface: "test_fixture", userGesture: "manual_scan" },
    });
    const suspicious = await analyzeUrl({
      url: "https://shop.example.co.uk/account/login",
      context: { surface: "test_fixture", userGesture: "manual_scan" },
    });
    const phishing = await analyzeUrl({
      url: "http://paypal.com@192.168.0.1/login?next=http://evil.tk/steal",
      context: { surface: "test_fixture", userGesture: "manual_scan" },
    });
    const unknown = await disabledAnalysis({
      url: "https://example.com",
      context: { surface: "test_fixture", userGesture: "manual_scan" },
    });

    const counts = summarizeVerdicts([safe, suspicious, phishing, unknown, safe]);
    expect(counts.total).toBe(5);
    expect(counts.safe).toBe(2);
    expect(counts.suspicious).toBe(1);
    expect(counts.phishing).toBe(1);
    expect(counts.unknown).toBe(1);
  });
});

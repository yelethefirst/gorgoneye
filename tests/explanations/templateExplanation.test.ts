import { describe, expect, it } from "vitest";
import { buildTemplateExplanation } from "../../src/explanations/templateExplanation";
import { analyzeUrl, disabledAnalysis } from "../../src/detection/analyzeUrl";

const FIXED_NOW = () => "2026-05-26T00:00:00.000Z";

describe("buildTemplateExplanation", () => {
  it("produces a phishing-flavored explanation for a phishing URL", async () => {
    const result = await analyzeUrl({
      url: "http://paypal.com@192.168.0.1/login?next=http://evil.tk/steal",
      context: { surface: "test_fixture", userGesture: "manual_scan" },
    });
    const exp = buildTemplateExplanation(result, { now: FIXED_NOW });
    expect(exp.mode).toBe("template");
    expect(exp.text).toMatch(/Strong evidence/i);
    expect(exp.text).toMatch(/Specifically:/);
    expect(exp.text).toMatch(/Confidence \d+%/);
    expect(exp.guidance.length).toBeGreaterThan(0);
    expect(exp.guidance.join(" ")).toMatch(/Do not enter credentials/);
    expect(exp.generatedAt).toBe(FIXED_NOW());
  });

  it("produces a suspicious-flavored explanation with pause guidance", async () => {
    const result = await analyzeUrl({
      url: "https://shop.example.co.uk/account/login",
      context: { surface: "test_fixture", userGesture: "manual_scan" },
    });
    const exp = buildTemplateExplanation(result, { now: FIXED_NOW });
    expect(exp.text).toMatch(/risk indicators/i);
    expect(exp.guidance.join(" ")).toMatch(/Pause/);
  });

  it("produces a safe explanation with no 'Specifically' section when nothing fired", async () => {
    const result = await analyzeUrl({
      url: "https://github.com/aegishield/gorgon-eye",
      context: { surface: "test_fixture", userGesture: "manual_scan" },
    });
    const exp = buildTemplateExplanation(result, { now: FIXED_NOW });
    expect(exp.text).toMatch(/no risk indicators/i);
    expect(exp.text).not.toMatch(/Specifically:/);
    expect(exp.text).not.toMatch(/Confidence/);
    expect(exp.guidance.join(" ")).toMatch(/No action needed/);
  });

  it("produces an unknown explanation for disabled-protection analyses", async () => {
    const result = await disabledAnalysis({
      url: "https://example.com",
      context: { surface: "test_fixture", userGesture: "manual_scan" },
    });
    const exp = buildTemplateExplanation(result, { now: FIXED_NOW });
    expect(exp.text).toMatch(/could not produce a verdict/i);
    expect(exp.guidance.join(" ")).toMatch(/protection is paused/i);
  });

  it("respects maxSignals when listing the 'Specifically' section", async () => {
    const result = await analyzeUrl({
      url: "http://paypal.com@192.168.0.1/login?next=http://evil.tk/steal",
      context: { surface: "test_fixture", userGesture: "manual_scan" },
    });
    const exp = buildTemplateExplanation(result, { now: FIXED_NOW, maxSignals: 1 });
    // Only one signal title should appear after "Specifically:" — no semicolons in that section.
    const m = exp.text.match(/Specifically: ([^.]+)\./);
    expect(m).not.toBeNull();
    expect(m![1]!.includes(";")).toBe(false);
  });

  it("is deterministic with the same `now` injection", async () => {
    const result = await analyzeUrl({
      url: "https://github.com/aegishield/gorgon-eye",
      context: { surface: "test_fixture", userGesture: "manual_scan" },
    });
    const a = buildTemplateExplanation(result, { now: FIXED_NOW });
    const b = buildTemplateExplanation(result, { now: FIXED_NOW });
    expect(a).toEqual(b);
  });
});

import { describe, expect, it } from "vitest";
import { analyzeUrl } from "../../src/detection/analyzeUrl";
import {
  buildExplanationPrompt,
  buildExplanationPromptPayload,
} from "../../src/explanations/promptBuilder";

describe("buildExplanationPrompt", () => {
  it("uses structured verdict data without the raw scanned URL", async () => {
    const result = await analyzeUrl({
      url: "https://paypa1.example/login?email=alice@example.com&token=secret-token",
      context: { surface: "test_fixture", userGesture: "manual_scan" },
    });

    const promptText = buildExplanationPrompt(result)
      .map((message) => message.content)
      .join("\n");

    expect(promptText).toContain("firedSignals");
    expect(promptText).toContain("Typosquatting");
    expect(promptText).not.toContain("alice@example.com");
    expect(promptText).not.toContain("secret-token");
    expect(promptText).not.toContain("paypa1.example/login");
  });

  it("keeps the prompt payload small and evidence-focused", async () => {
    const result = await analyzeUrl({
      url: "http://paypal.com@192.168.0.1/login?next=http://evil.tk/steal",
      context: { surface: "test_fixture", userGesture: "manual_scan" },
    });
    const payload = buildExplanationPromptPayload(result);

    expect(payload.verdict).toBe("phishing");
    expect(payload.firedSignals.length).toBeGreaterThan(0);
    expect(payload.firedSignals.length).toBeLessThanOrEqual(6);
    expect(payload.layers.some((layer) => layer.layer === "rules")).toBe(true);
  });
});

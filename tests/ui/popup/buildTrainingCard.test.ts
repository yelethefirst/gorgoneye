import { describe, expect, it } from "vitest";
import { buildTrainingCard } from "../../../src/ui/popup/buildTrainingCard";
import { analyzeUrl, disabledAnalysis } from "../../../src/detection/analyzeUrl";

const ctx = { surface: "test_fixture" as const, userGesture: "manual_scan" as const };

describe("buildTrainingCard", () => {
  it("returns null for a safe verdict", async () => {
    const result = await analyzeUrl({
      url: "https://github.com/aegishield/gorgon-eye",
      context: ctx,
    });
    expect(result.verdict).toBe("safe");
    expect(buildTrainingCard(result)).toBeNull();
  });

  it("returns null for a suspicious verdict", async () => {
    const result = await analyzeUrl({
      url: "https://shop.example.co.uk/account/login",
      context: ctx,
    });
    expect(result.verdict).toBe("suspicious");
    expect(buildTrainingCard(result)).toBeNull();
  });

  it("returns null for an unknown (disabled) verdict", async () => {
    const result = await disabledAnalysis({ url: "https://example.com", context: ctx });
    expect(buildTrainingCard(result)).toBeNull();
  });

  it("targets typosquatting first when both typosquatting and credentials fire", async () => {
    const result = await analyzeUrl({
      url: "https://paypa1.example/account/verify",
      context: ctx,
    });
    expect(result.verdict).toBe("phishing");
    const card = buildTrainingCard(result);
    expect(card).not.toBeNull();
    expect(card!.sourceRuleId).toBe("typosquatting");
    expect(card!.giveaway).toMatch(/PayPal/);
    const correct = card!.options.find((o) => o.correct);
    expect(correct).toBeDefined();
    expect(correct!.label).toMatch(/paypal\.com/);
  });

  it("targets embedded_credentials when typosquatting did not fire", async () => {
    // No brand-typo here: 'evil' is not close to any brand SLD.
    const result = await analyzeUrl({
      url: "http://paypal.com@evil.example/login?next=http://attacker.tld/steal",
      context: ctx,
    });
    expect(result.verdict).toBe("phishing");
    const card = buildTrainingCard(result);
    expect(card!.sourceRuleId).toBe("embedded_credentials");
    expect(card!.question).toContain("@");
    const correct = card!.options.find((o) => o.correct);
    expect(correct!.label).toMatch(/AFTER the "@"/);
  });

  it("targets ip_hostname when only IP + credential keywords fire", async () => {
    const result = await analyzeUrl({
      url: "http://10.0.0.1/account/verify",
      context: ctx,
    });
    expect(result.verdict).toBe("phishing");
    const card = buildTrainingCard(result);
    expect(card!.sourceRuleId).toBe("ip_hostname");
    expect(card!.giveaway).toMatch(/IPv4/);
  });

  it("each card has exactly one correct option", async () => {
    const result = await analyzeUrl({
      url: "https://paypa1.example/account/verify",
      context: ctx,
    });
    const card = buildTrainingCard(result)!;
    expect(card.options.filter((o) => o.correct)).toHaveLength(1);
    expect(card.options.length).toBeGreaterThanOrEqual(3);
  });

  it("returns a deterministic card across repeated calls (option order stable)", async () => {
    const result = await analyzeUrl({
      url: "https://paypa1.example/account/verify",
      context: ctx,
    });
    const a = buildTrainingCard(result)!;
    const b = buildTrainingCard(result)!;
    expect(a.options.map((o) => o.label)).toEqual(b.options.map((o) => o.label));
  });

  it("never reuses the question wording across different rule families", async () => {
    const typo = buildTrainingCard(
      await analyzeUrl({
        url: "https://paypa1.example/account/verify",
        context: ctx,
      }),
    )!;
    const ip = buildTrainingCard(
      await analyzeUrl({
        url: "http://10.0.0.1/account/verify",
        context: ctx,
      }),
    )!;
    expect(typo.question).not.toBe(ip.question);
  });
});

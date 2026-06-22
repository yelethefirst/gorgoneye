import { describe, expect, it } from "vitest";
import { analyzeUrl } from "../../src/detection/analyzeUrl";

const ctx = { surface: "test_fixture" as const, userGesture: "manual_scan" as const };

const HEADERS_ALL_PASS = [
  "Received: from mx.example.com (mx.example.com [203.0.113.10])",
  "        by mail.recipient.example with ESMTPS;",
  "        Mon, 01 Jun 2026 09:00:00 +0000",
  "Authentication-Results: mail.recipient.example;",
  "        spf=pass smtp.mailfrom=example.com;",
  "        dkim=pass header.i=@example.com header.s=selector;",
  "        dmarc=pass policy=reject",
  "From: News <news@example.com>",
  "Subject: Hello",
].join("\n");

const HEADERS_ALL_FAIL = [
  "Authentication-Results: mail.recipient.example;",
  "        spf=fail smtp.mailfrom=spoofed.example;",
  "        dkim=fail header.i=@spoofed.example;",
  "        dmarc=fail policy=reject",
  "From: Pretend Bank <noreply@spoofed.example>",
].join("\n");

const HEADERS_DMARC_ONLY_FAIL = [
  "Authentication-Results: mail.recipient.example;",
  "        spf=pass smtp.mailfrom=ok.example;",
  "        dkim=pass header.i=@ok.example;",
  "        dmarc=fail policy=reject",
].join("\n");

const HEADERS_GIBBERISH = "From: bob@example.com\nSubject: x\n";

describe("analyzeUrl + email-headers layer (AEG-7-3)", () => {
  it("without emailHeaderText: headers layer is in unavailableLayers, not in layers", async () => {
    const result = await analyzeUrl({
      url: "https://example.com/account",
      context: ctx,
    });
    expect(result.layers.headers).toBeUndefined();
    const headerUnavail = result.unavailableLayers.find((u) => u.layer === "headers");
    expect(headerUnavail).toBeDefined();
    expect(headerUnavail!.reason).toMatch(/Show original|No email headers/i);
  });

  it("with all-pass auth headers: layer populated, NO header signal fires", async () => {
    const baseline = await analyzeUrl({
      url: "https://example.com/account",
      context: ctx,
    });
    const result = await analyzeUrl({
      url: "https://example.com/account",
      context: ctx,
      emailHeaderText: HEADERS_ALL_PASS,
    });
    expect(result.layers.headers?.status).toBe("complete");
    expect(result.layers.headers?.spf).toBe("pass");
    expect(result.layers.headers?.dkim).toBe("pass");
    expect(result.layers.headers?.dmarc).toBe("pass");
    expect(result.firedSignals.some((s) => s.layer === "headers")).toBe(false);
    // Acceptance criterion: headers don't contribute to fusion.
    expect(result.confidence).toBeCloseTo(baseline.confidence, 4);
    expect(result.verdict).toBe(baseline.verdict);
  });

  it("with all-fail auth headers: signal fires with high severity, but verdict unchanged", async () => {
    const baseline = await analyzeUrl({
      url: "https://example.com/account",
      context: ctx,
    });
    const result = await analyzeUrl({
      url: "https://example.com/account",
      context: ctx,
      emailHeaderText: HEADERS_ALL_FAIL,
    });
    const sig = result.firedSignals.find((s) => s.layer === "headers");
    expect(sig).toBeDefined();
    expect(sig!.severity).toBe("high");
    expect(sig!.title).toMatch(/SPF.+DKIM.+DMARC/);
    // No fusion contribution; confidence and verdict match the headers-off run.
    expect(result.confidence).toBeCloseTo(baseline.confidence, 4);
    expect(result.verdict).toBe(baseline.verdict);
  });

  it("DMARC-only fail still elevates severity to high (DMARC is the alignment check)", async () => {
    const result = await analyzeUrl({
      url: "https://example.com/account",
      context: ctx,
      emailHeaderText: HEADERS_DMARC_ONLY_FAIL,
    });
    const sig = result.firedSignals.find((s) => s.layer === "headers");
    expect(sig?.severity).toBe("high");
    expect(sig?.title).toContain("DMARC");
    expect(sig?.title).not.toContain("SPF");
  });

  it("gibberish header text without recognised SPF/DKIM/DMARC: status not_available, no signal", async () => {
    const result = await analyzeUrl({
      url: "https://example.com/account",
      context: ctx,
      emailHeaderText: HEADERS_GIBBERISH,
    });
    expect(result.layers.headers).toBeUndefined();
    expect(result.firedSignals.some((s) => s.layer === "headers")).toBe(false);
    const headerUnavail = result.unavailableLayers.find((u) => u.layer === "headers");
    expect(headerUnavail).toBeDefined();
  });

  it("missing SPF reports `unknown` (not `pass`) per acceptance criteria", async () => {
    const onlyDkim = [
      "Authentication-Results: mail.recipient.example; dkim=pass header.i=@example.com",
    ].join("\n");
    const result = await analyzeUrl({
      url: "https://example.com/account",
      context: ctx,
      emailHeaderText: onlyDkim,
    });
    expect(result.layers.headers?.spf).toBe("unknown");
    expect(result.layers.headers?.dkim).toBe("pass");
    expect(result.layers.headers?.dmarc).toBe("unknown");
    // No signal — only explicit fails fire.
    expect(result.firedSignals.some((s) => s.layer === "headers")).toBe(false);
  });
});

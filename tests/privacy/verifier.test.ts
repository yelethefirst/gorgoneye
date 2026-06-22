import { describe, expect, it } from "vitest";
import { runPrivacyVerification } from "../../src/privacy/verifier";

describe("runPrivacyVerification", () => {
  it("returns a report with all checks passed on the default flow", async () => {
    const report = await runPrivacyVerification();
    expect(report.allPassed).toBe(true);
    expect(report.checks.length).toBeGreaterThanOrEqual(6);
    for (const c of report.checks) {
      expect(c.passed, `check ${c.id} should pass: ${c.detail}`).toBe(true);
    }
  });

  it("completes well under the 5-second budget", async () => {
    const report = await runPrivacyVerification();
    expect(report.durationMs).toBeLessThan(5000);
  });

  it("records at least one audit entry routed via hash-prefix flow", async () => {
    const report = await runPrivacyVerification();
    const hashCalls = report.auditRecords.filter(
      (r) => r.dataCategory === "hash_prefix" && r.purpose === "safe_browsing_full_hash",
    );
    expect(hashCalls.length).toBeGreaterThanOrEqual(1);
    expect(hashCalls.every((r) => r.containsFullScannedUrl === false)).toBe(true);
    expect(hashCalls.every((r) => r.containsEmailContent === false)).toBe(true);
  });

  it("never records a target_origin_request or scrubbed_telemetry call in the default flow", async () => {
    const report = await runPrivacyVerification();
    expect(report.auditRecords.some((r) => r.dataCategory === "target_origin_request")).toBe(false);
    expect(report.auditRecords.some((r) => r.dataCategory === "scrubbed_telemetry")).toBe(false);
  });

  it("returns a structured AnalysisResult with clean privacy summary", async () => {
    const report = await runPrivacyVerification();
    const r = report.result;
    expect(r.privacy.emailContentLeftDevice).toBe(false);
    expect(r.privacy.fullUrlSentToAegisService).toBe(false);
    expect(r.privacy.fullUrlSentToThreatIntel).toBe(false);
    expect(r.privacy.targetOriginContacted).toBe(false);
    expect(r.privacy.telemetrySent).toBe(false);
  });

  it("does not touch the production stores (each call uses fresh in-memory ones)", async () => {
    // Running twice should not accumulate audit records or prefix entries.
    const first = await runPrivacyVerification();
    const second = await runPrivacyVerification();
    expect(first.auditRecords.length).toBe(second.auditRecords.length);
  });
});

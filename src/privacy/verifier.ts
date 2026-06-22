import type { AuditRecord } from "../shared/audit";
import type { AnalysisResult } from "../shared/verdict";
import { analyzeUrl } from "../detection/analyzeUrl";
import { AuditStore } from "../audit/auditStore";
import { createMemoryKvStore } from "../storage/kvStore";
import { canonicalizeForSafeBrowsing } from "../threat-intel/canonicalize";
import { enumerateUrlExpressions } from "../threat-intel/expressions";
import { hashWithPrefix } from "../threat-intel/hash";
import { PrefixDb } from "../threat-intel/prefixDb";
import { SafeBrowsingClient } from "../threat-intel/safeBrowsing";
import { buildExplanationPrompt } from "../explanations/promptBuilder";
import { buildLlmTrainingCardPrompt } from "../explanations/llmTrainingCard";

export interface PrivacyCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface PrivacyVerificationReport {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  fixtureUrl: string;
  scannedAnalysisId: string;
  result: AnalysisResult;
  auditRecords: AuditRecord[];
  checks: PrivacyCheck[];
  allPassed: boolean;
}

const FIXTURE_URL = "https://demo-fixture.aegis.example/account/verify?next=/login";
const TIME_BUDGET_MS = 5000;

/**
 * Runs the documented privacy-verification flow against a synthetic fixture.
 *
 * The verifier intentionally uses *isolated* in-memory stores so it does not
 * pollute the user's real audit log or prefix DB. The privacy guarantees
 * verified here are structural — they hold for the production code path
 * because the same `auditedFetch` body-policy and `AuditRecord` type are used.
 */
export async function runPrivacyVerification(): Promise<PrivacyVerificationReport> {
  const startedAt = Date.now();

  // Isolated stores. The user's real audit log is not touched.
  const audit = new AuditStore(createMemoryKvStore());
  const prefixDb = new PrefixDb();

  // Seed a prefix that matches the fixture so the threat-intel network call
  // actually fires and produces an audit record we can inspect. The
  // `testFullHashResponse` keeps it offline — no real Safe Browsing call.
  const canonical = canonicalizeForSafeBrowsing(FIXTURE_URL);
  if (canonical) {
    const exps = enumerateUrlExpressions(canonical);
    if (exps[0]) {
      const { prefixHex } = await hashWithPrefix(exps[0]);
      await prefixDb.seed([
        {
          prefixHex,
          threatTypes: ["SOCIAL_ENGINEERING"],
          updatedAt: new Date(startedAt).toISOString(),
        },
      ]);
    }
  }

  const client = new SafeBrowsingClient(prefixDb, audit, {
    testFullHashResponse: { matches: [] }, // exercise the call without matching
  });

  const result = await analyzeUrl({
    url: FIXTURE_URL,
    context: { surface: "test_fixture", userGesture: "privacy_test" },
    threatIntel: client,
  });

  const auditRecords = await audit.recent();
  const llmPromptText = buildExplanationPrompt(result)
    .map((message) => message.content)
    .join("\n");
  const trainingCardPromptText = buildLlmTrainingCardPrompt(result)
    .map((message) => message.content)
    .join("\n");
  const finishedAt = Date.now();
  const durationMs = finishedAt - startedAt;

  const checks: PrivacyCheck[] = [
    {
      id: "no_email_content",
      label: "No audit record carries email content",
      passed: auditRecords.every((r) => r.containsEmailContent === false),
      detail: `${auditRecords.length} record(s) inspected; the AuditRecord type enforces this at compile time.`,
    },
    {
      id: "no_full_url_in_audit",
      label: "No audit record carries the full scanned URL",
      passed: auditRecords.every((r) => r.containsFullScannedUrl === false),
      detail:
        "Every outbound call must use a privacy-preserving payload. " +
        "The auditedFetch wrapper rejects URL-bearing bodies outside consented target-origin inspection.",
    },
    {
      id: "hash_prefix_used",
      label: "Threat-intel call used the hash-prefix flow",
      passed: auditRecords.some(
        (r) => r.dataCategory === "hash_prefix" && r.purpose === "safe_browsing_full_hash",
      ),
      detail: `Found ${
        auditRecords.filter((r) => r.dataCategory === "hash_prefix").length
      } hash-prefix call(s) routed to safebrowsing.googleapis.com.`,
    },
    {
      id: "no_telemetry",
      label: "No telemetry sent during verification",
      passed: !auditRecords.some((r) => r.dataCategory === "scrubbed_telemetry"),
      detail: "Telemetry is opt-in and currently off by default.",
    },
    {
      id: "no_visual_target_origin",
      label: "No target-origin visual inspection performed",
      passed: !auditRecords.some((r) => r.dataCategory === "target_origin_request"),
      detail: "Consent-gated; not part of the default flow.",
    },
    {
      id: "llm_prompt_structured_only",
      label: "LLM prompt contains structured verdict data only",
      passed:
        !llmPromptText.includes(FIXTURE_URL) &&
        !llmPromptText.includes("demo-fixture.aegis.example/account/verify") &&
        !llmPromptText.includes("next=/login"),
      detail:
        "The prompt builder accepts AnalysisResult data and excludes the raw scanned URL, email body, sender, recipient, and headers.",
    },
    {
      id: "training_card_prompt_structured_only",
      label: "Training-card prompt contains structured verdict data only",
      passed:
        !trainingCardPromptText.includes(FIXTURE_URL) &&
        !trainingCardPromptText.includes("demo-fixture.aegis.example/account/verify") &&
        !trainingCardPromptText.includes("next=/login"),
      detail:
        "The LLM training-card prompt reuses the same structured payload as the explanation prompt — no raw URL or content.",
    },
    {
      id: "privacy_summary_clean",
      label: "Result privacy summary asserts no email content / no full URL",
      passed:
        result.privacy.emailContentLeftDevice === false &&
        result.privacy.fullUrlSentToAegisService === false &&
        result.privacy.fullUrlSentToThreatIntel === false &&
        result.privacy.targetOriginContacted === false,
      detail: "Direct read of AnalysisResult.privacy.",
    },
    {
      id: "completed_under_budget",
      label: `Verification completed under ${TIME_BUDGET_MS} ms`,
      passed: durationMs < TIME_BUDGET_MS,
      detail: `Took ${durationMs} ms.`,
    },
  ];

  return {
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date(finishedAt).toISOString(),
    durationMs,
    fixtureUrl: FIXTURE_URL,
    scannedAnalysisId: result.analysisId,
    result,
    auditRecords,
    checks,
    allPassed: checks.every((c) => c.passed),
  };
}

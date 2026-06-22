import { useCallback, useState } from "react";
import { sendRequest } from "../../messaging/client";
import { newRequestId } from "../../shared/ids";
import type { PrivacyVerificationReport } from "../../privacy/verifier";
import { Badge, Button, Panel } from "../components";
import { cn } from "../components/cn";

export function PrivacyVerifier() {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<PrivacyVerificationReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const response = await sendRequest({
        type: "RUN_PRIVACY_VERIFICATION",
        requestId: newRequestId(),
      });
      if (response.type === "ERROR") setError(response.message);
      else setReport(response.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, []);

  return (
    <Panel
      title="Privacy verifier"
      description={
        "Runs a synthetic phishing fixture through the full pipeline against isolated " +
        "in-memory stores, then asserts the same privacy invariants the real flow upholds."
      }
      className="mt-4"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs text-text-secondary" aria-live="polite">
          {running
            ? "Running…"
            : report
              ? `Last run: ${report.durationMs} ms · ${report.checks.filter((c) => c.passed).length}/${report.checks.length} passed`
              : "Not run yet."}
        </span>
        <Button size="sm" variant="primary" onClick={run} disabled={running}>
          {running ? "Running…" : "Run verification"}
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-2 rounded border border-verdict-phishing/30 bg-verdict-phishing-soft px-2 py-1 text-xs text-verdict-phishing"
        >
          {error}
        </div>
      )}

      {report && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <Badge verdict={report.allPassed ? "safe" : "phishing"} size="sm">
              {report.allPassed ? "All checks passed" : "Failures"}
            </Badge>
            <code className="truncate">{report.fixtureUrl}</code>
          </div>

          <ul className="space-y-1">
            {report.checks.map((c) => (
              <li
                key={c.id}
                className="flex items-start gap-2 rounded border border-surface-border bg-surface px-2 py-1.5"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-1 inline-block size-2 shrink-0 rounded-full",
                    c.passed ? "bg-verdict-safe" : "bg-verdict-phishing",
                  )}
                />
                <div className="flex flex-col text-xs">
                  <span className="font-medium">{c.label}</span>
                  <span className="text-text-secondary">{c.detail}</span>
                </div>
              </li>
            ))}
          </ul>

          {report.auditRecords.length > 0 && (
            <details className="rounded border border-surface-border bg-surface px-2 py-1.5">
              <summary className="cursor-pointer text-xs font-medium">
                Outbound calls during verification ({report.auditRecords.length})
              </summary>
              <ul className="mt-1 space-y-0.5 text-2xs text-text-secondary">
                {report.auditRecords.map((r) => (
                  <li key={r.id}>
                    {r.method} {r.destinationHostname} · {r.purpose} · {r.dataCategory}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </Panel>
  );
}

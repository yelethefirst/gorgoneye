import { useCallback, useEffect, useMemo, useState } from "react";
import { sendRequest } from "../../src/messaging/client";
import { newRequestId } from "../../src/shared/ids";
import { isExtensionResponse } from "../../src/shared/messages";
import type { AnalysisResult, ExplanationResult, Verdict } from "../../src/shared/verdict";
import type { UserSettings } from "../../src/storage/settings";
import { Badge, Button, Panel, ProgressBar, Toggle } from "../../src/ui/components";
import { summarizeVerdicts, type CountSummary } from "../../src/ui/popupSummary";
import { VerdictDetailPanel, type ExplanationEvents } from "../../src/ui/popup/VerdictDetailPanel";
import { TransparencyPanel } from "../../src/ui/popup/TransparencyPanel";
import { computeTransparency } from "../../src/ui/popup/transparencyState";
import { TrainingStatsPanel } from "../../src/ui/popup/TrainingStatsPanel";
import type { AuditRecord } from "../../src/shared/audit";
import type { TrainingProgress } from "../../src/shared/training";
import { ZERO_TRAINING_PROGRESS } from "../../src/shared/training";

const POLL_MS = 3000;

export function App() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [verdicts, setVerdicts] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [training, setTraining] = useState<TrainingProgress>(ZERO_TRAINING_PROGRESS);
  const [snapshotAt, setSnapshotAt] = useState<number>(Date.now());
  const [ageSeconds, setAgeSeconds] = useState(0);

  const refresh = useCallback(async (opts: { foreground?: boolean } = {}) => {
    if (opts.foreground) setLoading(true);
    setError(null);
    try {
      const [settingsResp, recentResp, auditResp, trainingResp] = await Promise.all([
        sendRequest({ type: "GET_SETTINGS", requestId: newRequestId() }),
        sendRequest({ type: "GET_RECENT_VERDICTS", requestId: newRequestId(), limit: 10 }),
        sendRequest({ type: "GET_AUDIT_LOG", requestId: newRequestId(), limit: 200 }),
        sendRequest({ type: "GET_TRAINING_PROGRESS", requestId: newRequestId() }),
      ]);
      if (settingsResp.type === "ERROR") setError(settingsResp.message);
      else setSettings(settingsResp.settings);
      if (recentResp.type === "ERROR") setError(recentResp.message);
      else setVerdicts(recentResp.results);
      if (auditResp.type === "ERROR") setError(auditResp.message);
      else setAuditRecords(auditResp.records);
      if (trainingResp.type === "ERROR") setError(trainingResp.message);
      else setTraining(trainingResp.progress);
      setSnapshotAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (opts.foreground) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh({ foreground: true });
  }, [refresh]);

  // Poll for live transparency updates while the popup is open.
  useEffect(() => {
    const interval = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  // Update "Updated Ns ago" every second without re-fetching.
  useEffect(() => {
    const tick = setInterval(() => {
      setAgeSeconds(Math.floor((Date.now() - snapshotAt) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [snapshotAt]);

  const onToggleProtection = useCallback(async (next: boolean) => {
    setError(null);
    try {
      const response = await sendRequest({
        type: "UPDATE_SETTINGS",
        requestId: newRequestId(),
        patch: { enabled: next },
      });
      if (response.type === "ERROR") setError(response.message);
      else setSettings(response.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const onScan = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const target = manualUrl.trim();
      if (!target) return;
      setLoading(true);
      setError(null);
      try {
        const response = await sendRequest({
          type: "ANALYZE_URL",
          requestId: newRequestId(),
          url: target,
          context: { surface: "popup_manual_scan", userGesture: "manual_scan" },
        });
        if (response.type === "ERROR") setError(response.message);
        else {
          setManualUrl("");
          await refresh({ foreground: true });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [manualUrl, refresh],
  );

  const counts = useMemo(() => summarizeVerdicts(verdicts), [verdicts]);
  const protectionOn = settings?.enabled ?? true;
  const selected = useMemo(
    () => verdicts.find((v) => v.analysisId === selectedId) ?? null,
    [verdicts, selectedId],
  );
  const transparency = useMemo(() => {
    if (!settings) return null;
    return computeTransparency({
      settings,
      auditRecords,
      lastVerdict: verdicts[0] ?? null,
      now: snapshotAt,
    });
  }, [settings, auditRecords, verdicts, snapshotAt]);

  const onExplain = useCallback(
    async (
      result: AnalysisResult,
      events?: ExplanationEvents,
    ): Promise<ExplanationResult | void> => {
      const requestId = newRequestId();
      const mode = settings?.layers.localLlm ? "local_llm" : "template";

      const listener = (message: unknown) => {
        // We always return false here because we never use sendResponse on
        // this channel — the background already responds via its own
        // EXPLAIN_VERDICT_RESULT promise resolution. Returning false (or
        // undefined) keeps the runtime message port from staying open
        // waiting for a response we'd never send.
        if (!events || !isExtensionResponse(message) || message.requestId !== requestId) {
          return false;
        }
        if (message.type === "EXPLAIN_VERDICT_PROGRESS") {
          events.onProgress({
            phase: message.phase,
            message: message.message,
            progress: message.progress,
          });
        }
        if (message.type === "EXPLAIN_VERDICT_CHUNK") {
          events.onToken(message.text);
        }
        return false;
      };

      const cancel = () => {
        void sendRequest({
          type: "CANCEL_EXPLAIN_VERDICT",
          requestId: newRequestId(),
          targetRequestId: requestId,
        }).catch(() => undefined);
      };

      if (events) {
        chrome.runtime.onMessage.addListener(listener);
        events.signal.addEventListener("abort", cancel, { once: true });
      }

      try {
        if (events?.signal.aborted) return;
        events?.onProgress({
          phase: mode === "local_llm" ? "loading" : "generating",
          message:
            mode === "local_llm"
              ? "Loading local explanation model."
              : "Building template explanation.",
        });
        const response = await sendRequest({
          type: "EXPLAIN_VERDICT",
          requestId,
          analysisId: result.analysisId,
          mode,
        });
        if (events?.signal.aborted) return;
        if (response.type === "ERROR") throw new Error(response.message);
        return response.explanation;
      } finally {
        if (events) {
          chrome.runtime.onMessage.removeListener(listener);
          events.signal.removeEventListener("abort", cancel);
        }
      }
    },
    [settings?.layers.localLlm],
  );

  const onInspectVisually = useCallback(
    async (result: AnalysisResult, consented: boolean): Promise<AnalysisResult | void> => {
      const response = await sendRequest({
        type: "INSPECT_VISUALLY",
        requestId: newRequestId(),
        analysisId: result.analysisId,
        consented,
      });
      if (response.type === "ERROR") throw new Error(response.message);
      // The background updated its verdict cache; refresh the popup state too
      // so the recent-verdicts list reflects the new visual layer.
      void refresh();
      return response.result;
    },
    [refresh],
  );

  const onUpgradeTrainingCard = useCallback(async (result: AnalysisResult) => {
    try {
      const response = await sendRequest({
        type: "BUILD_LLM_TRAINING_CARD",
        requestId: newRequestId(),
        analysisId: result.analysisId,
      });
      if (response.type === "ERROR") return null;
      return { card: response.card, mode: response.mode };
    } catch {
      return null;
    }
  }, []);

  const onTrainingAnswer = useCallback(async (correct: boolean) => {
    try {
      const response = await sendRequest({
        type: "RECORD_TRAINING_ANSWER",
        requestId: newRequestId(),
        correct,
      });
      if (response.type !== "ERROR") setTraining(response.progress);
    } catch {
      // Best-effort; never surface a training-recording error to the user.
    }
  }, []);

  if (selected) {
    return (
      <VerdictDetailPanel
        result={selected}
        onBack={() => setSelectedId(null)}
        onExplain={onExplain}
        onInspectVisually={onInspectVisually}
        visualInspectionEnabled={settings?.layers.visualInspection ?? false}
        onUpgradeTrainingCard={onUpgradeTrainingCard}
        onTrainingAnswer={onTrainingAnswer}
      />
    );
  }

  return (
    <div
      aria-busy={loading || undefined}
      className="w-90 bg-surface-muted p-3 font-sans text-text-primary"
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold">Gorgon Eye</h1>
          <p className="text-xs text-text-secondary">
            Local-first phishing defense. Email content stays on your device.
          </p>
        </div>
      </header>

      <Panel
        title={protectionOn ? "Protection is on" : "Protection is paused"}
        description={
          protectionOn
            ? "Links are evaluated locally with the rules engine."
            : "No URLs will be analysed until you re-enable protection."
        }
      >
        <Toggle
          checked={protectionOn}
          onChange={onToggleProtection}
          label="Enable Aegis"
          description="Master switch. Off means no scanning at all."
          disabled={settings === null}
        />
      </Panel>

      {transparency && (
        <div className="mt-3">
          <TransparencyPanel state={transparency} ageSeconds={ageSeconds} />
        </div>
      )}

      <div className="mt-3">
        <TrainingStatsPanel progress={training} />
      </div>

      <Panel
        title="Scan counters"
        description="From the recent verdict cache. Cleared when the cache TTL elapses."
        className="mt-3"
      >
        <CountersGrid counts={counts} />
      </Panel>

      <Panel title="Manual scan" description="Paste a URL to evaluate it locally." className="mt-3">
        <form onSubmit={onScan} className="flex gap-2">
          <input
            type="url"
            required
            value={manualUrl}
            placeholder="https://example.com/login"
            onChange={(e) => setManualUrl(e.target.value)}
            className="flex-1 rounded border border-surface-border bg-white px-2 py-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring"
          />
          <Button type="submit" variant="primary" size="sm" disabled={loading || !protectionOn}>
            Scan
          </Button>
        </form>
      </Panel>

      {error && (
        <div
          role="alert"
          className="mt-2 rounded border border-verdict-phishing/30 bg-verdict-phishing-soft px-2 py-1 text-xs text-verdict-phishing"
        >
          {error}
        </div>
      )}

      <Panel
        title="Recent verdicts"
        description="The 10 most recent URLs Aegis evaluated."
        className="mt-3"
      >
        {verdicts.length === 0 ? (
          <p className="text-xs text-text-tertiary">
            No verdicts yet. Hover a link on a webpage or use the scan box above.
          </p>
        ) : (
          <ul className="-mx-1 divide-y divide-surface-border">
            {verdicts.map((v) => (
              <li key={v.analysisId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(v.analysisId)}
                  className="flex w-full flex-col gap-1 rounded px-1 py-2 text-left hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  aria-label={`Open details for ${v.urlDisplay}`}
                >
                  <div className="flex items-center gap-2">
                    <Badge verdict={v.verdict} size="sm" />
                    <span className="text-2xs text-text-tertiary">
                      {Math.round(v.confidence * 100)}%
                    </span>
                    <code className="ml-auto truncate text-2xs text-text-secondary">
                      {v.urlDisplay}
                    </code>
                  </div>
                  <ProgressBar value={v.confidence} verdict={v.verdict} />
                  {v.firedSignals[0] && (
                    <span className="text-2xs text-text-secondary">{v.firedSignals[0].title}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <footer className="mt-3 text-center text-2xs text-text-tertiary">
        Rules engine — Epic 2. No network calls performed yet.
      </footer>
    </div>
  );
}

function CountersGrid({ counts }: { counts: CountSummary }) {
  const cells: Array<{ verdict: Verdict | "total"; label: string; value: number }> = [
    { verdict: "total", label: "Total", value: counts.total },
    { verdict: "safe", label: "Safe", value: counts.safe },
    { verdict: "suspicious", label: "Suspicious", value: counts.suspicious },
    { verdict: "phishing", label: "Phishing", value: counts.phishing },
  ];

  return (
    <dl className="grid grid-cols-4 gap-2">
      {cells.map((c) => (
        <div
          key={c.label}
          className="flex flex-col items-center rounded border border-surface-border bg-surface px-2 py-1.5 text-center"
        >
          <dt className="text-2xs uppercase tracking-wide text-text-tertiary">{c.label}</dt>
          <dd
            className={
              "mt-0.5 text-base font-semibold " +
              (c.verdict === "phishing"
                ? "text-verdict-phishing"
                : c.verdict === "suspicious"
                  ? "text-verdict-suspicious"
                  : c.verdict === "safe"
                    ? "text-verdict-safe"
                    : "text-text-primary")
            }
          >
            {c.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

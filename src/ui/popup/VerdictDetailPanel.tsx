import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AnalysisResult,
  ExplanationResult,
  LayerId,
  PrivacySummary,
  SignalSeverity,
} from "../../shared/verdict";
import { Badge, Button, Panel, ProgressBar } from "../components";
import { cn } from "../components/cn";
import { buildTrainingCard, type TrainingCard as TrainingCardData } from "./buildTrainingCard";
import { TrainingCard } from "./TrainingCard";
import { ConsentPrompt, type ConsentDecision } from "../visual/ConsentPrompt";

export interface VerdictDetailPanelProps {
  result: AnalysisResult;
  onBack(): void;
  onExplain?(
    result: AnalysisResult,
    events?: ExplanationEvents,
  ): Promise<ExplanationResult | void> | ExplanationResult | void;
  /**
   * Called after the user makes a consent decision in the ConsentPrompt.
   * Implementations should:
   *   - When `consented` is true: run the inspection and return the updated
   *     `AnalysisResult` (or throw on hard failure).
   *   - When `consented` is false: still call through so the background can
   *     write the `declined` audit row required by ADR-0013. May return void.
   */
  onInspectVisually?(
    result: AnalysisResult,
    consented: boolean,
  ): Promise<AnalysisResult | void> | AnalysisResult | void;
  /**
   * Whether the visual inspection layer toggle is on in user settings. When
   * false the "Inspect visually" button is hidden.
   */
  visualInspectionEnabled?: boolean;
  /**
   * Called once when the detail panel opens for a phishing verdict. Should
   * resolve with the LLM-personalized training card (mode=local_llm) when the
   * model is available, or the deterministic template card (mode=template).
   * Returning null skips the upgrade flow entirely.
   */
  onUpgradeTrainingCard?(
    result: AnalysisResult,
  ): Promise<{ card: TrainingCardData | null; mode: "local_llm" | "template" } | null>;
  /** Fired when the user answers the training card. Fire-and-forget on the caller. */
  onTrainingAnswer?(correct: boolean): void;
}

export interface ExplanationEvents {
  signal: AbortSignal;
  onProgress(progress: {
    phase: "loading" | "generating" | "fallback";
    message: string;
    progress?: number;
  }): void;
  onToken(text: string): void;
}

const LAYER_LABEL: Record<LayerId, string> = {
  rules: "Rules engine",
  ml: "Local ML classifier",
  threat_intel: "Threat intelligence",
  explanation: "Explanation",
  visual: "Visual brand inspection",
  headers: "Email header analysis",
};

const SEVERITY_COLOR: Record<SignalSeverity, string> = {
  info: "text-text-tertiary",
  low: "text-verdict-suspicious",
  medium: "text-verdict-suspicious",
  high: "text-verdict-phishing",
  critical: "text-verdict-phishing",
};

const PRIVACY_LABELS: Array<{
  key: keyof PrivacySummary;
  label: string;
  goodValue: boolean | "any";
}> = [
  { key: "emailContentLeftDevice", label: "Email content stayed on device", goodValue: false },
  {
    key: "fullUrlSentToAegisService",
    label: "No full URL sent to Aegis services",
    goodValue: false,
  },
  { key: "fullUrlSentToThreatIntel", label: "No full URL sent to threat intel", goodValue: false },
  {
    key: "hashPrefixSentToThreatIntel",
    label: "Hash prefix sent to threat intel",
    goodValue: "any",
  },
  { key: "targetOriginContacted", label: "No target-origin request made", goodValue: false },
  { key: "telemetrySent", label: "No telemetry sent", goodValue: false },
];

export function VerdictDetailPanel({
  result,
  onBack,
  onExplain,
  onInspectVisually,
  visualInspectionEnabled = false,
  onUpgradeTrainingCard,
  onTrainingAnswer,
}: VerdictDetailPanelProps) {
  const [explaining, setExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<ExplanationResult | null>(null);
  const [explainProgress, setExplainProgress] = useState<string | null>(null);
  const [streamedExplanation, setStreamedExplanation] = useState("");
  const [trainingDismissed, setTrainingDismissed] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [liveResult, setLiveResult] = useState<AnalysisResult>(result);
  useEffect(() => {
    setLiveResult(result);
  }, [result]);
  const displayResult = liveResult;
  const templateTrainingCard = useMemo(
    () => buildTrainingCard(displayResult),
    [displayResult],
  );
  const [upgradedCard, setUpgradedCard] = useState<TrainingCardData | null>(null);
  const [trainingCardMode, setTrainingCardMode] = useState<"local_llm" | "template">(
    "template",
  );
  const trainingCard = upgradedCard ?? templateTrainingCard;
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Reset the upgraded card whenever the underlying analysis ID changes — a
  // new verdict means the cached card is no longer relevant.
  useEffect(() => {
    setUpgradedCard(null);
    setTrainingCardMode("template");
  }, [displayResult.analysisId]);

  // Fire-and-forget request for an LLM-personalized card. The template card
  // is shown immediately while this resolves; if a better card comes back,
  // we swap it in. Only runs when there's a phishing verdict to teach about.
  useEffect(() => {
    if (!onUpgradeTrainingCard) return;
    if (displayResult.verdict !== "phishing") return;
    let cancelled = false;
    void (async () => {
      try {
        const upgrade = await onUpgradeTrainingCard(displayResult);
        if (cancelled || !upgrade?.card) return;
        setUpgradedCard(upgrade.card);
        setTrainingCardMode(upgrade.mode);
      } catch {
        // Silently keep the template card. The popup is best-effort here.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [displayResult, onUpgradeTrainingCard]);

  const visualLayer = displayResult.layers.visual;
  const visualAlreadyComplete = visualLayer?.status === "complete";
  const canInspectVisually =
    visualInspectionEnabled && Boolean(onInspectVisually) && !visualAlreadyComplete;
  const topSignal = displayResult.firedSignals[0]?.title;

  const handleConsentDecision = async (decision: ConsentDecision) => {
    setShowConsent(false);
    if (!onInspectVisually) return;
    setInspectError(null);
    setInspecting(true);
    try {
      const updated = await onInspectVisually(displayResult, decision === "consented");
      if (mountedRef.current && updated && typeof updated === "object" && "analysisId" in updated) {
        setLiveResult(updated);
      }
    } catch (err) {
      if (mountedRef.current) {
        setInspectError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (mountedRef.current) setInspecting(false);
    }
  };

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const handleExplain = async () => {
    if (!onExplain) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setExplainError(null);
    setExplainProgress(null);
    setStreamedExplanation("");
    setExplanation(null);
    setExplaining(true);
    try {
      const out = await onExplain(result, {
        signal: controller.signal,
        onProgress: ({ message, progress }) => {
          const pct =
            typeof progress === "number" && Number.isFinite(progress)
              ? ` ${Math.round(progress * 100)}%`
              : "";
          if (mountedRef.current) setExplainProgress(`${message}${pct}`);
        },
        onToken: (text) => {
          if (mountedRef.current) setStreamedExplanation((current) => current + text);
        },
      });
      if (
        mountedRef.current &&
        !controller.signal.aborted &&
        out &&
        typeof out === "object" &&
        "text" in out
      ) {
        setExplanation(out);
      }
    } catch (err) {
      if (mountedRef.current && !controller.signal.aborted) {
        setExplainError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (mountedRef.current && abortRef.current === controller) {
        abortRef.current = null;
        setExplaining(false);
      }
    }
  };

  const cancelExplain = () => {
    abortRef.current?.abort();
    setExplainProgress("Cancelling local explanation.");
    setExplaining(false);
  };

  return (
    <div className="w-90 bg-surface-muted p-3 font-sans text-text-primary">
      <div className="mb-2 flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onBack} aria-label="Back to popup">
          ← Back
        </Button>
        <Badge verdict={displayResult.verdict} size="sm" />
        <span className="text-2xs text-text-tertiary">
          {Math.round(displayResult.confidence * 100)}%
        </span>
      </div>

      <Panel
        title={<code className="text-xs break-all">{displayResult.urlDisplay}</code>}
        description={`Analysed in ${Math.round(displayResult.timings.totalMs)} ms`}
      >
        <ProgressBar value={displayResult.confidence} verdict={displayResult.verdict} />
      </Panel>

      <Panel title="Layer breakdown" className="mt-3">
        <ul className="-mx-1 divide-y divide-surface-border">
          {Object.entries(displayResult.layers).map(([layerKey, layer]) => {
            if (!layer) return null;
            const label = LAYER_LABEL[layerKey as LayerId] ?? layerKey;
            const score =
              "score" in layer && typeof layer.score === "number"
                ? layer.score
                : "probability" in layer && typeof layer.probability === "number"
                  ? layer.probability
                  : "matched" in layer
                    ? layer.matched
                      ? 1
                      : 0
                    : null;
            // Threat-intel layer carries provider + lookup mode metadata the
            // user can read to verify what was sent off-device.
            const provenance =
              "provider" in layer && "lookupMode" in layer
                ? `via ${layer.provider} · ${layer.lookupMode}`
                : null;
            return (
              <li key={layerKey} className="flex items-center justify-between px-1 py-2">
                <div className="flex flex-col">
                  <span className="text-xs font-medium">{label}</span>
                  <span className="text-2xs text-text-tertiary">
                    Status: {String(layer.status)}
                    {"durationMs" in layer && typeof layer.durationMs === "number"
                      ? ` · ${Math.round(layer.durationMs)} ms`
                      : ""}
                  </span>
                  {provenance && <span className="text-2xs text-text-tertiary">{provenance}</span>}
                </div>
                {score !== null && (
                  <span className="text-xs font-semibold tabular-nums">
                    {(score * 100).toFixed(0)}%
                  </span>
                )}
              </li>
            );
          })}
          {displayResult.unavailableLayers.map((u) => (
            <li
              key={`unavail-${u.layer}`}
              className="flex items-center justify-between gap-2 px-1 py-2"
            >
              <div className="flex flex-col">
                <span className="text-xs font-medium text-text-secondary">
                  {LAYER_LABEL[u.layer] ?? u.layer}
                </span>
                <span className="text-2xs text-text-tertiary">{u.reason}</span>
              </div>
              <span className="text-2xs uppercase tracking-wide text-text-tertiary">
                Unavailable
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="Fired signals"
        description={
          displayResult.firedSignals.length === 0
            ? "Nothing fired — no risk indicators were found."
            : `${displayResult.firedSignals.length} signal${displayResult.firedSignals.length === 1 ? "" : "s"} fired.`
        }
        className="mt-3"
      >
        {displayResult.firedSignals.length === 0 ? null : (
          <ul className="space-y-1.5">
            {displayResult.firedSignals.map((s) => (
              <li
                key={s.id}
                className="rounded border border-surface-border bg-surface px-2 py-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">{s.title}</span>
                  <span
                    className={cn("text-2xs uppercase tracking-wide", SEVERITY_COLOR[s.severity])}
                  >
                    {s.severity}
                  </span>
                </div>
                <p className="mt-0.5 text-2xs text-text-secondary">{s.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Privacy summary"
        description="What this analysis did (and did not) send off your device."
        className="mt-3"
      >
        <ul className="space-y-1">
          {PRIVACY_LABELS.map(({ key, label, goodValue }) => {
            const actual = displayResult.privacy[key];
            const isGood = goodValue === "any" || actual === goodValue ? "good" : "warn";
            return (
              <li key={key} className="flex items-start gap-2 text-2xs">
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 inline-block size-2 shrink-0 rounded-full",
                    isGood === "good" ? "bg-verdict-safe" : "bg-verdict-suspicious",
                  )}
                />
                <span className="text-text-secondary">
                  {label}
                  {goodValue === "any" && (
                    <em className="ml-1 not-italic text-text-tertiary">
                      ({actual ? "yes" : "no"})
                    </em>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={handleExplain}
          disabled={!onExplain || explaining}
        >
          {explaining ? "Explaining…" : "Explain this verdict"}
        </Button>
        {explaining && (
          <Button variant="secondary" size="sm" onClick={cancelExplain}>
            Cancel
          </Button>
        )}
        {canInspectVisually && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowConsent(true)}
            disabled={inspecting}
          >
            {inspecting ? "Inspecting…" : "Inspect visually"}
          </Button>
        )}
        <span className="ml-auto text-2xs text-text-tertiary">
          Analysis ID: {displayResult.analysisId.slice(0, 10)}…
        </span>
      </div>

      {inspectError && (
        <div
          role="alert"
          className="mt-2 rounded border border-verdict-suspicious/30 bg-verdict-suspicious-soft px-2 py-1 text-2xs text-verdict-suspicious"
        >
          {inspectError}
        </div>
      )}

      {showConsent && (
        <ConsentPrompt
          request={{
            urlDisplay: displayResult.urlDisplay,
            triggeredBy: topSignal
              ? { verdict: displayResult.verdict, topSignal }
              : { verdict: displayResult.verdict },
          }}
          onDecide={handleConsentDecision}
        />
      )}

      {explainError && (
        <div
          role="alert"
          className="mt-2 rounded border border-verdict-suspicious/30 bg-verdict-suspicious-soft px-2 py-1 text-2xs text-verdict-suspicious"
        >
          {explainError}
        </div>
      )}

      {(explaining || streamedExplanation) && !explanation && (
        <Panel
          title="Explanation in progress"
          description={explainProgress ?? "Preparing local explanation."}
          className="mt-3"
        >
          {streamedExplanation ? (
            <p className="whitespace-pre-wrap text-xs text-text-primary">{streamedExplanation}</p>
          ) : (
            <p className="text-xs text-text-tertiary">Waiting for model output.</p>
          )}
        </Panel>
      )}

      {explanation && (
        <Panel title="Explanation" description={`Mode: ${explanation.mode}`} className="mt-3">
          <p className="text-xs text-text-primary">{explanation.text}</p>
          {explanation.guidance.length > 0 && (
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-2xs text-text-secondary">
              {explanation.guidance.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {trainingCard && !trainingDismissed && (
        <>
          {trainingCardMode === "local_llm" && (
            <p className="mt-3 -mb-2 text-2xs uppercase tracking-wide text-text-tertiary">
              Personalized by the local LLM.
            </p>
          )}
          <TrainingCard
            card={trainingCard}
            onDismiss={() => setTrainingDismissed(true)}
            {...(onTrainingAnswer ? { onAnswer: onTrainingAnswer } : {})}
          />
        </>
      )}
    </div>
  );
}

import type {
  AnalysisResult,
  ExplanationResult,
  SignalSeverity,
} from "../shared/verdict";

const VERDICT_INTRO: Record<AnalysisResult["verdict"], string> = {
  phishing: "Strong evidence this URL is malicious.",
  suspicious: "This URL shows one or more risk indicators.",
  safe: "Our local rules found no risk indicators in this URL.",
  unknown: "Aegis could not produce a verdict for this URL.",
};

const VERDICT_GUIDANCE: Record<AnalysisResult["verdict"], readonly string[]> = {
  phishing: [
    "Do not enter credentials or personal information on this page.",
    "Close the tab and open the brand's website directly from a bookmark or a search you started yourself.",
    "Report the message as phishing to your email provider or IT team.",
  ],
  suspicious: [
    "Pause before clicking through.",
    "Verify by visiting the legitimate site from a bookmark or search, not from this link.",
    "Hover the link in the email and check the domain matches the brand you expect.",
  ],
  safe: [
    "No action needed, but stay cautious if the message itself was unexpected.",
    "Context still matters — links can be safe even when the sender is not.",
  ],
  unknown: [
    "Treat this URL with extra care since Aegis could not classify it.",
    "If protection is paused, re-enable it in the popup; otherwise inspect the link manually before clicking.",
  ],
};

const SEVERITY_RANK: Record<SignalSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

function topSignalTitles(result: AnalysisResult, max: number): string[] {
  return [...result.firedSignals]
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
    .slice(0, max)
    .map((s) => s.title);
}

export interface TemplateOptions {
  /** Inject for deterministic tests. Defaults to new Date().toISOString(). */
  now?: () => string;
  /** How many signal titles to mention. Default 2. */
  maxSignals?: number;
}

export function buildTemplateExplanation(
  result: AnalysisResult,
  opts: TemplateOptions = {},
): ExplanationResult {
  const now = opts.now ?? (() => new Date().toISOString());
  const maxSignals = opts.maxSignals ?? 2;

  const sentences: string[] = [VERDICT_INTRO[result.verdict]];
  const topTitles = topSignalTitles(result, maxSignals);
  if (topTitles.length > 0) {
    sentences.push(`Specifically: ${topTitles.join("; ")}.`);
  }
  if (result.verdict !== "safe" && result.verdict !== "unknown") {
    sentences.push(
      `Confidence ${Math.round(result.confidence * 100)}% from ${result.firedSignals.length} fired signal${result.firedSignals.length === 1 ? "" : "s"}.`,
    );
  }

  return {
    text: sentences.join(" "),
    guidance: [...VERDICT_GUIDANCE[result.verdict]],
    mode: "template",
    generatedAt: now(),
  };
}

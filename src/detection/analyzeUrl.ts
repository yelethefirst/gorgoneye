import type {
  AnalysisResult,
  HeaderResult,
  LayerId,
  MlResult,
  SignalSeverity,
  ThreatIntelResult,
  UrlContext,
  VisualResult,
} from "../shared/verdict";
import { newAnalysisId } from "../shared/ids";
import { sha256Hex } from "../shared/hash";
import { parseUrl } from "../rules/parseUrl";
import { defaultRulesEngine } from "../rules/engine";
import type { RulesEngine } from "../rules/engine";
import { fuseLayers, verdictFromScore, type LayerContribution } from "./fusion";
import { buildHeaderResult } from "./headerParser";
import type { SafeBrowsingClient } from "../threat-intel/safeBrowsing";
import type { MlClient } from "../ml/mlClient";
import type { VisualClient } from "../visual/visualClient";

const PRIVACY_DEFAULTS = {
  emailContentLeftDevice: false,
  fullUrlSentToAegisService: false,
  fullUrlSentToThreatIntel: false,
  targetOriginContacted: false,
  telemetrySent: false,
} as const;

interface UnavailableLayer {
  layer: LayerId;
  reason: string;
}

const UNAVAILABLE_BY_DEFAULT: UnavailableLayer[] = [];

export interface AnalyzeUrlInput {
  url: string;
  context: UrlContext;
  now?: number;
  ttlMs?: number;
  engine?: RulesEngine;
  /** When supplied, the threat-intel layer runs. Omit to leave it unavailable. */
  threatIntel?: SafeBrowsingClient;
  /** When supplied, the local ML layer runs. Omit to leave it unavailable. */
  ml?: MlClient;
  /** When supplied, the visual-inspection layer runs. Omit to leave it unavailable. */
  visual?: VisualClient;
  /**
   * Raw RFC 5322 header text for the email this URL was found in (e.g. the
   * `<pre>`-rendered output of Gmail's "Show original" view). When supplied,
   * the email-headers layer parses SPF/DKIM/DMARC out and emits a signal if
   * any of those mechanisms explicitly fails. Per AEG-7-3 acceptance:
   * missing headers report `not_available`, never "pass", and the headers
   * layer does NOT contribute to the URL fusion score — it's surfaced as a
   * sibling signal alongside the URL verdict.
   */
  emailHeaderText?: string;
}

function safeDisplay(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    return `${url.protocol}//${url.hostname}${url.pathname}`;
  } catch {
    return rawUrl.slice(0, 120);
  }
}

export async function analyzeUrl(input: AnalyzeUrlInput): Promise<AnalysisResult> {
  const startedAt = input.now ?? Date.now();
  const ttlMs = input.ttlMs ?? 24 * 60 * 60 * 1000;
  const engine = input.engine ?? defaultRulesEngine;

  const parsed = parseUrl(input.url);
  const rules = engine.analyze(parsed);
  const urlHash = await sha256Hex(parsed.canonicalUrl || input.url);

  // Run threat-intel, ML, and visual in parallel — all three are independent.
  const [threatIntel, ml, visual] = await Promise.all([
    input.threatIntel && !parsed.parseError
      ? input.threatIntel.lookup(input.url)
      : Promise.resolve<ThreatIntelResult | undefined>(undefined),
    input.ml ? input.ml.predict(parsed) : Promise.resolve<MlResult | undefined>(undefined),
    input.visual
      ? input.visual.inspect(parsed)
      : Promise.resolve<VisualResult | undefined>(undefined),
  ]);

  // Header parsing is pure CPU and synchronous; no point chaining a microtask.
  const headers: HeaderResult | undefined =
    typeof input.emailHeaderText === "string"
      ? buildHeaderResult(input.emailHeaderText)
      : undefined;

  const contributions: LayerContribution[] = [{ layer: "rules", score: rules.score }];
  if (threatIntel?.matched) {
    contributions.push({ layer: "threat_intel", score: 1 });
  }
  // ML contributes only when it's a confident positive (status complete AND
  // probability >= the client's configured threshold). Missing or
  // under-threshold ML never counts as "safe" — it's simply absent from the
  // fusion contributions array.
  if (
    ml?.status === "complete" &&
    ml.probability !== null &&
    input.ml &&
    ml.probability >= input.ml.fusionThreshold
  ) {
    contributions.push({ layer: "ml", score: ml.probability });
  }
  // Visual contributes only when a confirmed brand spoof is detected. The
  // score is the perceptual similarity; the fusion layer weight (0.85)
  // brings it down to a reasonable fused contribution.
  if (visual?.status === "complete" && typeof visual.score === "number" && visual.score > 0) {
    contributions.push({ layer: "visual", score: visual.score });
  }
  const fusedScore = fuseLayers(contributions);

  const verdict = parsed.parseError ? "unknown" : verdictFromScore(fusedScore);
  const confidence = parsed.parseError ? 0 : fusedScore;

  const firedSignals = rules.signals
    .filter((s) => s.fired)
    .map((s) => ({
      layer: "rules" as LayerId,
      id: s.id,
      severity: s.severity as SignalSeverity,
      title: s.name,
      detail: s.description,
    }));

  if (threatIntel?.matched) {
    firedSignals.push({
      layer: "threat_intel",
      id: "safe_browsing_match",
      severity: "critical",
      title: "Listed on Google Safe Browsing",
      detail: `Threat types: ${threatIntel.threatTypes.join(", ") || "unspecified"}.`,
    });
  }

  if (
    ml?.status === "complete" &&
    ml.probability !== null &&
    input.ml &&
    ml.probability >= input.ml.fusionThreshold
  ) {
    firedSignals.push({
      layer: "ml",
      id: "ml_classifier",
      severity: ml.probability >= 0.85 ? "high" : "medium",
      title: "Local ML classifier flagged this URL",
      detail: `Probability ${Math.round(ml.probability * 100)}% (model ${ml.modelVersion ?? "unknown"}).`,
    });
  }

  if (visual?.status === "complete" && visual.matchedBrand && (visual.score ?? 0) > 0) {
    firedSignals.push({
      layer: "visual",
      id: "visual_brand_spoof",
      severity: "high",
      title: `Visual match against ${visual.matchedBrand}`,
      detail: `Hamming distance ${visual.hammingDistance} (similarity ${Math.round(
        (visual.similarity ?? 0) * 100,
      )}%); hostname is not on this brand's legitimate-domain list.`,
    });
  }

  // Header signal: explicit `fail` on any of SPF/DKIM/DMARC is the
  // teachable signal the demo wants to highlight. `unknown` and `not_available`
  // are deliberately silent — we never claim authentication failed when we
  // simply weren't given the data.
  if (headers?.status === "complete") {
    const failed: string[] = [];
    if (headers.spf === "fail") failed.push("SPF");
    if (headers.dkim === "fail") failed.push("DKIM");
    if (headers.dmarc === "fail") failed.push("DMARC");
    if (failed.length > 0) {
      firedSignals.push({
        layer: "headers",
        id: "auth_header_fail",
        severity: failed.includes("DMARC") ? "high" : "medium",
        title: `${failed.join(" + ")} authentication failed`,
        detail:
          "The email this link came from did not pass authentication. " +
          "That doesn't automatically make this URL phishing, but the " +
          "sender domain is not who the headers claim.",
      });
    }
  }

  const unavailableLayers: UnavailableLayer[] = [...UNAVAILABLE_BY_DEFAULT];
  if (!threatIntel) {
    unavailableLayers.unshift({
      layer: "threat_intel",
      reason:
        "Threat-intel client is not configured. Enable Safe Browsing in settings to turn this on.",
    });
  }
  if (!ml) {
    unavailableLayers.unshift({
      layer: "ml",
      reason: "Local ML classifier is not configured. Enable it in settings to turn this on.",
    });
  }
  if (!visual) {
    unavailableLayers.unshift({
      layer: "visual",
      reason:
        "Visual brand inspection is not configured. Enable it in settings; each scan is consent-gated.",
    });
  }
  if (!headers || headers.status === "not_available") {
    unavailableLayers.unshift({
      layer: "headers",
      reason:
        headers?.evidence?.[0] ??
        "No email headers were supplied for this URL. Open the email's 'Show original' view to enable header analysis.",
    });
  }

  const totalMs = Math.max(1, Date.now() - startedAt);

  return {
    analysisId: newAnalysisId(),
    urlDisplay: safeDisplay(input.url),
    urlHash,
    verdict,
    confidence,
    createdAt: new Date(startedAt).toISOString(),
    expiresAt: new Date(startedAt + ttlMs).toISOString(),
    timings: {
      totalMs,
      rulesMs: rules.durationMs,
      ...(threatIntel ? { threatIntelMs: threatIntel.durationMs } : {}),
      ...(ml ? { mlMs: ml.durationMs } : {}),
    },
    layers: {
      rules,
      ...(threatIntel ? { threatIntel } : {}),
      ...(ml ? { ml } : {}),
      ...(visual ? { visual } : {}),
      ...(headers && headers.status !== "not_available" ? { headers } : {}),
    },
    firedSignals,
    privacy: {
      ...PRIVACY_DEFAULTS,
      hashPrefixSentToThreatIntel: Boolean(threatIntel?.hashPrefixSent),
      targetOriginContacted: Boolean(visual?.targetOriginContacted),
      auditRecordIds: [],
    },
    unavailableLayers,
  };
}

/**
 * Builds a placeholder "protection paused" result. Used when the master
 * protection toggle is off. No rules execute, nothing is cached.
 */
export async function disabledAnalysis(input: AnalyzeUrlInput): Promise<AnalysisResult> {
  const startedAt = input.now ?? Date.now();
  const ttlMs = input.ttlMs ?? 60 * 1000;
  const urlHash = await sha256Hex(input.url);
  const totalMs = Math.max(1, Date.now() - startedAt);

  return {
    analysisId: newAnalysisId(),
    urlDisplay: safeDisplay(input.url),
    urlHash,
    verdict: "unknown",
    confidence: 0,
    createdAt: new Date(startedAt).toISOString(),
    expiresAt: new Date(startedAt + ttlMs).toISOString(),
    timings: { totalMs },
    layers: {
      rules: {
        layer: "rules",
        status: "complete",
        score: 0,
        durationMs: 0,
        signals: [],
      },
    },
    firedSignals: [],
    privacy: {
      ...PRIVACY_DEFAULTS,
      hashPrefixSentToThreatIntel: false,
      auditRecordIds: [],
    },
    unavailableLayers: [
      { layer: "rules", reason: "Protection is currently disabled in settings." },
      { layer: "ml", reason: "Protection is currently disabled in settings." },
      { layer: "threat_intel", reason: "Protection is currently disabled in settings." },
      { layer: "visual", reason: "Protection is currently disabled in settings." },
      { layer: "headers", reason: "Protection is currently disabled in settings." },
      ...UNAVAILABLE_BY_DEFAULT,
    ],
  };
}

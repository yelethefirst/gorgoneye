export type Verdict = "safe" | "suspicious" | "phishing" | "unknown";

export type LayerId =
  | "rules"
  | "ml"
  | "threat_intel"
  | "explanation"
  | "visual"
  | "headers";

export type SignalSeverity = "info" | "low" | "medium" | "high" | "critical";

export interface UrlContext {
  surface:
    | "gmail"
    | "outlook"
    | "generic_page"
    | "popup_manual_scan"
    | "test_fixture";
  tabId?: number;
  frameId?: number;
  elementId?: string;
  userGesture:
    | "hover"
    | "email_open"
    | "badge_click"
    | "manual_scan"
    | "privacy_test";
  visibleTextHash?: string;
}

export interface RuleSignal {
  id: string;
  layer: "rules";
  name: string;
  fired: boolean;
  severity: SignalSeverity;
  weight: number;
  score: number;
  description: string;
  evidence: Record<string, string | number | boolean | string[]>;
}

export interface RulesResult {
  layer: "rules";
  status: "complete" | "error";
  score: number;
  durationMs: number;
  signals: RuleSignal[];
  error?: string;
}

export interface MlResult {
  layer: "ml";
  status: "complete" | "unavailable" | "error";
  probability: number | null;
  modelVersion: string | null;
  featureSchemaVersion: string | null;
  durationMs: number;
  error?: string;
}

export interface ThreatIntelResult {
  layer: "threat_intel";
  status: "complete" | "unavailable" | "error";
  provider: "google_safe_browsing";
  lookupMode: "hash_prefix";
  matched: boolean;
  threatTypes: string[];
  hashPrefixSent: string | null;
  durationMs: number;
  error?: string;
}

export type HeaderAuthStatus = "pass" | "fail" | "neutral" | "unknown";

export interface HeaderResult {
  layer: "headers";
  status: "not_available" | "complete" | "error";
  spf?: HeaderAuthStatus;
  dkim?: HeaderAuthStatus;
  dmarc?: HeaderAuthStatus;
  evidence: string[];
  error?: string;
}

export interface VisualResult {
  layer: "visual";
  status: "not_requested" | "requires_consent" | "complete" | "unavailable" | "error";
  consentRequired: boolean;
  targetOriginContacted: boolean;
  matchedBrand?: string;
  legitimateDomains?: string[];
  hammingDistance?: number;
  similarity?: number;
  /** Fusion score in [0, 1]: similarity when a spoof is confirmed, 0 otherwise. */
  score?: number;
  durationMs?: number;
  error?: string;
}

export interface ExplanationResult {
  /** 2-3 sentence plain-language summary. */
  text: string;
  /** Actionable bullets the user can act on right now. */
  guidance: string[];
  /** How the explanation was produced. */
  mode: "template" | "local_llm";
  /** ISO-8601 timestamp. */
  generatedAt: string;
}

export interface PrivacySummary {
  emailContentLeftDevice: false;
  fullUrlSentToAegisService: false;
  fullUrlSentToThreatIntel: false;
  hashPrefixSentToThreatIntel: boolean;
  targetOriginContacted: boolean;
  telemetrySent: boolean;
  auditRecordIds: string[];
}

export interface AnalysisResult {
  analysisId: string;
  urlDisplay: string;
  urlHash: string;
  verdict: Verdict;
  confidence: number;
  createdAt: string;
  expiresAt: string;
  timings: {
    totalMs: number;
    rulesMs?: number;
    mlMs?: number;
    threatIntelMs?: number;
    fusionMs?: number;
  };
  layers: {
    rules: RulesResult;
    ml?: MlResult;
    threatIntel?: ThreatIntelResult;
    visual?: VisualResult;
    headers?: HeaderResult;
  };
  firedSignals: Array<{
    layer: LayerId;
    id: string;
    severity: SignalSeverity;
    title: string;
    detail: string;
  }>;
  privacy: PrivacySummary;
  unavailableLayers: Array<{ layer: LayerId; reason: string }>;
}

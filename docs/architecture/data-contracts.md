# Data Contracts

These contracts are the implementation target for the TypeScript codebase. They are intentionally explicit so content scripts, background orchestration, workers, UI, and tests share one vocabulary.

## Verdict Types

```ts
export type Verdict = "safe" | "suspicious" | "phishing" | "unknown";

export type LayerId =
  | "rules"
  | "ml"
  | "threat_intel"
  | "explanation"
  | "visual"
  | "headers";

export type SignalSeverity = "info" | "low" | "medium" | "high" | "critical";
```

## Message Contracts

```ts
export type ExtensionMessage =
  | AnalyzeUrlRequest
  | AnalyzeUrlResult
  | GetVerdictRequest
  | GetVerdictResult
  | ExplainVerdictRequest
  | ExplainVerdictChunk
  | ExplainVerdictResult
  | AuditLogUpdated;

export interface AnalyzeUrlRequest {
  type: "ANALYZE_URL";
  requestId: string;
  url: string;
  context: UrlContext;
}

export interface AnalyzeUrlResult {
  type: "ANALYZE_URL_RESULT";
  requestId: string;
  result: AnalysisResult;
}

export interface GetVerdictRequest {
  type: "GET_VERDICT";
  requestId: string;
  urlHash: string;
}

export interface GetVerdictResult {
  type: "GET_VERDICT_RESULT";
  requestId: string;
  result?: AnalysisResult;
}

export interface ExplainVerdictRequest {
  type: "EXPLAIN_VERDICT";
  requestId: string;
  analysisId: string;
  mode: "template" | "local_llm";
}

export interface CancelExplainVerdictRequest {
  type: "CANCEL_EXPLAIN_VERDICT";
  requestId: string;
  targetRequestId: string;
}

export interface ExplainVerdictProgress {
  type: "EXPLAIN_VERDICT_PROGRESS";
  requestId: string;
  phase: "loading" | "generating" | "fallback";
  message: string;
  progress?: number;
}

export interface ExplainVerdictChunk {
  type: "EXPLAIN_VERDICT_CHUNK";
  requestId: string;
  text: string;
  done: false;
}

export interface ExplainVerdictResult {
  type: "EXPLAIN_VERDICT_RESULT";
  requestId: string;
  explanation: ExplanationResult;
}

export interface AuditLogUpdated {
  type: "AUDIT_LOG_UPDATED";
  latestRecordId: string;
}
```

## URL Context

```ts
export interface UrlContext {
  surface: "gmail" | "outlook" | "generic_page" | "popup_manual_scan" | "test_fixture";
  tabId?: number;
  frameId?: number;
  elementId?: string;
  userGesture: "hover" | "email_open" | "badge_click" | "manual_scan" | "privacy_test";
  visibleTextHash?: string;
  // Do not add raw email body, sender, recipient, or full visible text.
}
```

## Parsed URL

```ts
export interface ParsedUrl {
  originalUrl: string;
  canonicalUrl: string;
  scheme: string;
  hostname: string | null;
  port: string | null;
  path: string;
  query: string;
  fragment: string;
  registrableDomain: string | null;
  publicSuffix: string | null;
  subdomain: string | null;
  isIpAddress: boolean;
  isIdn: boolean;
  isPunycode: boolean;
  parseError?: string;
}
```

## Rule Signal

```ts
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
```

## ML Result

```ts
export interface MlResult {
  layer: "ml";
  status: "complete" | "unavailable" | "error";
  probability: number | null;
  modelVersion: string | null;
  featureSchemaVersion: string | null;
  topFeatureContributions?: Array<{
    feature: string;
    direction: "safer" | "riskier";
    impact: number;
  }>;
  durationMs: number;
  error?: string;
}
```

## Threat Intelligence Result

```ts
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
```

## Visual Result

```ts
export interface VisualResult {
  layer: "visual";
  status: "not_requested" | "requires_consent" | "complete" | "unavailable" | "error";
  consentRequired: boolean;
  targetOriginContacted: boolean;
  matchedBrand?: string;
  legitimateDomains?: string[];
  hammingDistance?: number;
  similarity?: number;
  score?: number;
  durationMs?: number;
  error?: string;
}
```

## Header Result

```ts
export interface HeaderResult {
  layer: "headers";
  status: "not_available" | "complete" | "error";
  spf?: "pass" | "fail" | "neutral" | "unknown";
  dkim?: "pass" | "fail" | "neutral" | "unknown";
  dmarc?: "pass" | "fail" | "neutral" | "unknown";
  evidence: string[];
  error?: string;
}
```

## Analysis Result

```ts
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
  unavailableLayers: Array<{
    layer: LayerId;
    reason: string;
  }>;
}
```

## Privacy Summary

```ts
export interface PrivacySummary {
  emailContentLeftDevice: false;
  fullUrlSentToAegisService: false;
  fullUrlSentToThreatIntel: false;
  hashPrefixSentToThreatIntel: boolean;
  targetOriginContacted: boolean;
  telemetrySent: boolean;
  auditRecordIds: string[];
}
```

## Audit Record

```ts
export interface AuditRecord {
  id: string;
  timestamp: string;
  destinationHostname: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  purpose:
    | "safe_browsing_update"
    | "safe_browsing_full_hash"
    | "model_download"
    | "visual_inspection_target_origin"
    | "telemetry_opt_in"
    | "demo_fixture";
  dataCategory:
    | "hash_prefix"
    | "model_asset"
    | "target_origin_request"
    | "scrubbed_telemetry"
    | "fixture";
  requestBytes: number;
  responseBytes?: number;
  status?: number;
  containsEmailContent: false;
  containsFullScannedUrl: boolean;
  userConsented: boolean;
}
```

## Storage Keys

```ts
export interface UserSettings {
  enabled: boolean;
  layers: {
    rules: boolean;
    ml: boolean;
    threatIntel: boolean;
    localLlm: boolean;
    visualInspection: boolean;
    headerAnalysis: boolean;
  };
  telemetryOptIn: boolean;
  visualInspectionConsentMode: "never" | "ask_each_time" | "managed_policy";
  trustedDomains: string[];
  cacheTtlHours: number;
}

export interface VerdictCacheEntry {
  urlHash: string;
  canonicalUrlDisplay: string;
  result: AnalysisResult;
  createdAt: string;
  expiresAt: string;
  detectionVersion: string;
}
```

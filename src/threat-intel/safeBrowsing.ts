import type { ThreatIntelResult } from "../shared/verdict";
import type { AuditStore } from "../audit/auditStore";
import { auditedFetch } from "../audit/auditedFetch";
import { canonicalizeForSafeBrowsing } from "./canonicalize";
import { enumerateUrlExpressions } from "./expressions";
import { hashWithPrefix } from "./hash";
import type { PrefixDb, ThreatType } from "./prefixDb";

const FULL_HASH_URL = "https://safebrowsing.googleapis.com/v4/fullHashes:find";

interface FullHashResponseMatch {
  threatType: ThreatType;
  threat: { hash: string }; // base64-encoded SHA-256
}

interface FullHashResponse {
  matches?: FullHashResponseMatch[];
}

function base64ToHex(b64: string): string {
  const bin = atob(b64);
  let hex = "";
  for (let i = 0; i < bin.length; i += 1) {
    hex += bin.charCodeAt(i).toString(16).padStart(2, "0");
  }
  return hex;
}

export interface SafeBrowsingClientOptions {
  apiKey?: string;
  /** Inject a fetch impl (Node tests pass a vi.fn; production uses globalThis.fetch). */
  fetchImpl?: (input: string, init: RequestInit) => Promise<Response>;
  /** When set, skips network I/O and uses this canned response for fullHashes:find. */
  testFullHashResponse?: FullHashResponse;
  /** Override `now` for deterministic audit timestamps in tests. */
  now?: () => number;
}

export class SafeBrowsingClient {
  constructor(
    private readonly prefixDb: PrefixDb,
    private readonly auditStore: AuditStore,
    private readonly opts: SafeBrowsingClientOptions = {},
  ) {}

  async lookup(url: string): Promise<ThreatIntelResult> {
    const start = performanceNow();

    const canonical = canonicalizeForSafeBrowsing(url);
    if (!canonical) {
      return failed(
        "canonicalization_failed",
        `Could not canonicalize URL "${url}" for Safe Browsing.`,
        start,
      );
    }

    const expressions = enumerateUrlExpressions(canonical);
    const hashed = await Promise.all(
      expressions.map(async (expression) => ({
        expression,
        ...(await hashWithPrefix(expression)),
      })),
    );

    // Local prefix-DB filter. Only prefixes that hit the local DB ever travel.
    const prefixMatches: typeof hashed = [];
    for (const h of hashed) {
      if (await this.prefixDb.hasPrefix(h.prefixHex)) {
        prefixMatches.push(h);
      }
    }

    if (prefixMatches.length === 0) {
      return {
        layer: "threat_intel",
        status: "complete",
        provider: "google_safe_browsing",
        lookupMode: "hash_prefix",
        matched: false,
        threatTypes: [],
        hashPrefixSent: null,
        durationMs: performanceNow() - start,
      };
    }

    // Body carries ONLY hash prefixes — never the URL or any URL component.
    const requestBody = JSON.stringify({
      client: { clientId: "aegis-gorgon", clientVersion: "0.0.1" },
      threatInfo: {
        threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"],
        platformTypes: ["ANY_PLATFORM"],
        threatEntryTypes: ["URL"],
        threatEntries: prefixMatches.map((p) => ({ hash: p.prefixHex })),
      },
    });

    const endpoint = this.opts.apiKey
      ? `${FULL_HASH_URL}?key=${encodeURIComponent(this.opts.apiKey)}`
      : FULL_HASH_URL;

    let bodyText = "";
    let httpStatus = 0;
    try {
      const result = await auditedFetch(
        {
          url: endpoint,
          method: "POST",
          body: requestBody,
          headers: { "content-type": "application/json" },
          purpose: "safe_browsing_full_hash",
          dataCategory: "hash_prefix",
          ...(this.opts.testFullHashResponse
            ? {
                testMode: {
                  status: 200,
                  body: JSON.stringify(this.opts.testFullHashResponse),
                },
              }
            : {}),
        },
        { store: this.auditStore, ...(this.opts.fetchImpl ? { fetchImpl: this.opts.fetchImpl } : {}), ...(this.opts.now ? { now: this.opts.now } : {}) },
      );
      bodyText = result.bodyText;
      httpStatus = result.status;
    } catch (err) {
      return {
        layer: "threat_intel",
        status: "unavailable",
        provider: "google_safe_browsing",
        lookupMode: "hash_prefix",
        matched: false,
        threatTypes: [],
        hashPrefixSent: prefixMatches.map((p) => p.prefixHex).join(","),
        durationMs: performanceNow() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    if (httpStatus < 200 || httpStatus >= 300) {
      return {
        layer: "threat_intel",
        status: "error",
        provider: "google_safe_browsing",
        lookupMode: "hash_prefix",
        matched: false,
        threatTypes: [],
        hashPrefixSent: prefixMatches.map((p) => p.prefixHex).join(","),
        durationMs: performanceNow() - start,
        error: `Safe Browsing returned HTTP ${httpStatus}`,
      };
    }

    let parsed: FullHashResponse;
    try {
      parsed = JSON.parse(bodyText) as FullHashResponse;
    } catch {
      return failed(
        "parse_failed",
        "Safe Browsing response was not JSON.",
        start,
        prefixMatches.map((p) => p.prefixHex).join(","),
      );
    }

    // Final match: compare full hashes locally.
    const localFullHashes = new Set(hashed.map((h) => h.hashHex));
    const matched: ThreatType[] = [];
    for (const m of parsed.matches ?? []) {
      const candidateHex = base64ToHex(m.threat.hash);
      if (localFullHashes.has(candidateHex) && !matched.includes(m.threatType)) {
        matched.push(m.threatType);
      }
    }

    return {
      layer: "threat_intel",
      status: "complete",
      provider: "google_safe_browsing",
      lookupMode: "hash_prefix",
      matched: matched.length > 0,
      threatTypes: matched,
      hashPrefixSent: prefixMatches.map((p) => p.prefixHex).join(","),
      durationMs: performanceNow() - start,
    };
  }
}

function performanceNow(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function failed(
  code: string,
  message: string,
  start: number,
  hashPrefixSent: string | null = null,
): ThreatIntelResult {
  return {
    layer: "threat_intel",
    status: "error",
    provider: "google_safe_browsing",
    lookupMode: "hash_prefix",
    matched: false,
    threatTypes: [],
    hashPrefixSent,
    durationMs: performanceNow() - start,
    error: `${code}: ${message}`,
  };
}

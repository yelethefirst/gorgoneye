import type { HeaderResult } from "../shared/verdict";

type AuthStatus = "pass" | "fail" | "neutral" | "unknown";

/**
 * Parses the raw text of email headers (typically what Gmail's "Show Original"
 * view shows) and extracts the SPF, DKIM, and DMARC authentication results.
 *
 * Two header sources are recognised:
 *   - Top-level `Received-SPF: …` lines (per RFC 7208).
 *   - `Authentication-Results: …` lines (per RFC 8601), where SPF, DKIM, and
 *     DMARC are listed inline as `mechanism=status`.
 *
 * Missing values are reported as `"unknown"` with `status: "not_available"` —
 * we never default a missing mechanism to "pass".
 *
 * The parser is intentionally tolerant: it lowercases keys, ignores comments,
 * and surfaces evidence strings so the UI can show the user where each
 * verdict came from.
 */

const AUTH_RESULTS_LINE = /^authentication-results\s*:\s*(.*)$/i;
const RECEIVED_SPF_LINE = /^received-spf\s*:\s*(\S+)/i;
const MECHANISM_TOKEN = /\b(spf|dkim|dmarc)\s*=\s*([a-z_]+)/gi;

function unfoldHeaders(raw: string): string[] {
  // Header continuation lines start with whitespace (RFC 5322 § 2.2.3).
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (line.length === 0) continue;
    if (/^[ \t]/.test(line) && out.length > 0) {
      out[out.length - 1] += " " + line.trim();
    } else {
      out.push(line);
    }
  }
  return out;
}

function normaliseStatus(raw: string): AuthStatus {
  const v = raw.trim().toLowerCase();
  if (v === "pass") return "pass";
  if (v === "fail" || v === "softfail" || v === "permerror" || v === "temperror") return "fail";
  if (v === "none" || v === "neutral" || v === "policy") return "neutral";
  return "unknown";
}

function extractFromAuthenticationResults(line: string): {
  spf?: AuthStatus;
  dkim?: AuthStatus;
  dmarc?: AuthStatus;
} {
  const out: { spf?: AuthStatus; dkim?: AuthStatus; dmarc?: AuthStatus } = {};
  let match: RegExpExecArray | null;
  MECHANISM_TOKEN.lastIndex = 0;
  while ((match = MECHANISM_TOKEN.exec(line)) !== null) {
    const key = match[1]!.toLowerCase() as "spf" | "dkim" | "dmarc";
    if (out[key]) continue; // keep the FIRST occurrence per mechanism
    out[key] = normaliseStatus(match[2]!);
  }
  return out;
}

export interface ParsedHeaderSignals {
  spf: AuthStatus;
  dkim: AuthStatus;
  dmarc: AuthStatus;
  evidence: string[];
  hadAuthenticationResults: boolean;
  hadReceivedSpf: boolean;
}

export function parseEmailHeaders(raw: string): ParsedHeaderSignals {
  const out: ParsedHeaderSignals = {
    spf: "unknown",
    dkim: "unknown",
    dmarc: "unknown",
    evidence: [],
    hadAuthenticationResults: false,
    hadReceivedSpf: false,
  };
  if (typeof raw !== "string" || raw.trim().length === 0) return out;

  const lines = unfoldHeaders(raw);
  for (const line of lines) {
    const authMatch = AUTH_RESULTS_LINE.exec(line);
    if (authMatch) {
      out.hadAuthenticationResults = true;
      const fields = extractFromAuthenticationResults(authMatch[1]!);
      if (fields.spf && out.spf === "unknown") out.spf = fields.spf;
      if (fields.dkim && out.dkim === "unknown") out.dkim = fields.dkim;
      if (fields.dmarc && out.dmarc === "unknown") out.dmarc = fields.dmarc;
      out.evidence.push(line);
      continue;
    }
    const spfMatch = RECEIVED_SPF_LINE.exec(line);
    if (spfMatch) {
      out.hadReceivedSpf = true;
      if (out.spf === "unknown") out.spf = normaliseStatus(spfMatch[1]!);
      out.evidence.push(line);
    }
  }

  return out;
}

/**
 * Wraps `parseEmailHeaders` in the `HeaderResult` contract from
 * docs/architecture/data-contracts.md. Returns `not_available` when no
 * recognised header source was present, so missing data never reads as "pass".
 */
export function buildHeaderResult(raw: string | null | undefined): HeaderResult {
  if (!raw || raw.trim().length === 0) {
    return {
      layer: "headers",
      status: "not_available",
      evidence: ["No header source was available."],
    };
  }
  const parsed = parseEmailHeaders(raw);
  if (!parsed.hadAuthenticationResults && !parsed.hadReceivedSpf) {
    return {
      layer: "headers",
      status: "not_available",
      evidence: ["Headers were provided but contained no SPF/DKIM/DMARC records."],
    };
  }
  return {
    layer: "headers",
    status: "complete",
    spf: parsed.spf,
    dkim: parsed.dkim,
    dmarc: parsed.dmarc,
    evidence: parsed.evidence.slice(0, 5),
  };
}

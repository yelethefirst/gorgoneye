import type { ParsedUrl } from "../../shared/parsedUrl";
import type { RuleSignal } from "../../shared/verdict";
import type { Rule } from "../types";
import { RULE_WEIGHTS } from "../weights";

const PERCENT_ENCODED_RE = /%[0-9a-fA-F]{2}/g;

export interface ExcessiveLengthOptions {
  /** URL length above which the rule fires. Default 150. */
  maxLength?: number;
  /** Ratio (encoded bytes / total length) above which the rule fires. Default 0.1. */
  maxPercentEncodedRatio?: number;
}

const DEFAULTS = { maxLength: 150, maxPercentEncodedRatio: 0.1 } as const;

export function createExcessiveLengthRule(opts: ExcessiveLengthOptions = {}): Rule {
  const maxLength = opts.maxLength ?? DEFAULTS.maxLength;
  const maxRatio = opts.maxPercentEncodedRatio ?? DEFAULTS.maxPercentEncodedRatio;
  const weight = RULE_WEIGHTS.excessive_length;

  return {
    id: "excessive_length",
    name: "Excessive URL length or encoding",
    defaultWeight: weight,

    evaluate(parsed: ParsedUrl): RuleSignal {
      if (parsed.parseError) {
        return notFired(weight, "URL did not parse.");
      }
      const url = parsed.originalUrl;
      const length = url.length;
      const encodedCount = (url.match(PERCENT_ENCODED_RE) ?? []).length;
      const encodedBytes = encodedCount * 3;
      const ratio = length === 0 ? 0 : encodedBytes / length;

      const longUrl = length > maxLength;
      // Require both a heavy ratio AND multiple encoded sequences, so a single
      // %20 in a short URL doesn't trip the rule on its own.
      const heavyEncoding = ratio > maxRatio && encodedCount >= 3;
      const fired = longUrl || heavyEncoding;

      if (!fired) {
        return notFired(
          weight,
          `URL is ${length} chars (limit ${maxLength}); ${(ratio * 100).toFixed(1)}% percent-encoded (limit ${(maxRatio * 100).toFixed(1)}%).`,
        );
      }

      const reasons: string[] = [];
      if (longUrl) reasons.push(`length ${length} exceeds ${maxLength}`);
      if (heavyEncoding) {
        reasons.push(`${(ratio * 100).toFixed(1)}% percent-encoded exceeds ${(maxRatio * 100).toFixed(1)}%`);
      }

      return {
        id: "excessive_length",
        layer: "rules",
        name: "Excessive URL length or encoding",
        fired: true,
        severity: "low",
        weight,
        score: weight,
        description: `URL shows structural anomalies: ${reasons.join(", ")}. Phishing kits often pad URLs to push the malicious portion out of view.`,
        evidence: {
          urlLength: length,
          maxLength,
          percentEncodedBytes: encodedBytes,
          percentEncodedRatio: Number(ratio.toFixed(4)),
          maxPercentEncodedRatio: maxRatio,
          longUrl,
          heavyEncoding,
        },
      };
    },
  };
}

function notFired(weight: number, description: string): RuleSignal {
  return {
    id: "excessive_length",
    layer: "rules",
    name: "Excessive URL length or encoding",
    fired: false,
    severity: "info",
    weight,
    score: 0,
    description,
    evidence: {},
  };
}

export const excessiveLengthRule: Rule = createExcessiveLengthRule();

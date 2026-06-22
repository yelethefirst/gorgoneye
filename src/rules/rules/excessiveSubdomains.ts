import type { ParsedUrl } from "../../shared/parsedUrl";
import type { RuleSignal } from "../../shared/verdict";
import type { Rule } from "../types";
import { RULE_WEIGHTS } from "../weights";

export interface ExcessiveSubdomainsOptions {
  /** Fires when the subdomain label count is strictly greater than this. Default: 3. */
  threshold?: number;
}

const DEFAULT_THRESHOLD = 3;

function subdomainDepth(subdomain: string | null): number {
  if (!subdomain) return 0;
  return subdomain.split(".").filter(Boolean).length;
}

export function createExcessiveSubdomainsRule(
  opts: ExcessiveSubdomainsOptions = {},
): Rule {
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const weight = RULE_WEIGHTS.excessive_subdomains;

  return {
    id: "excessive_subdomains",
    name: "Excessive subdomains",
    defaultWeight: weight,

    evaluate(parsed: ParsedUrl): RuleSignal {
      if (parsed.isIpAddress) {
        return notFired(weight, "Hostname is an IP literal; subdomain depth is not applicable.");
      }
      const depth = subdomainDepth(parsed.subdomain);
      const fired = depth > threshold;

      if (!fired) {
        return notFired(
          weight,
          `Subdomain depth is ${depth}, within the configured threshold of ${threshold}.`,
        );
      }

      return {
        id: "excessive_subdomains",
        layer: "rules",
        name: "Excessive subdomains",
        fired: true,
        severity: "low",
        weight,
        score: weight,
        description: `Hostname has ${depth} subdomain labels (threshold ${threshold}). Phishing kits often hide the real domain behind many subdomains.`,
        evidence: {
          subdomain: parsed.subdomain ?? "",
          depth,
          threshold,
          registrableDomain: parsed.registrableDomain ?? "",
        },
      };
    },
  };
}

function notFired(weight: number, description: string): RuleSignal {
  return {
    id: "excessive_subdomains",
    layer: "rules",
    name: "Excessive subdomains",
    fired: false,
    severity: "info",
    weight,
    score: 0,
    description,
    evidence: {},
  };
}

export const excessiveSubdomainsRule: Rule = createExcessiveSubdomainsRule();

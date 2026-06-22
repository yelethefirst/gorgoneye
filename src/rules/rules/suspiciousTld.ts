import type { ParsedUrl } from "../../shared/parsedUrl";
import type { RuleSignal } from "../../shared/verdict";
import type { Rule } from "../types";
import { RULE_WEIGHTS } from "../weights";
import { DEFAULT_SUSPICIOUS_TLDS } from "../data/suspiciousTlds";

export interface SuspiciousTldOptions {
  tlds?: Iterable<string>;
}

export function createSuspiciousTldRule(opts: SuspiciousTldOptions = {}): Rule {
  const tlds = new Set(
    Array.from(opts.tlds ?? DEFAULT_SUSPICIOUS_TLDS, (t) => t.toLowerCase()),
  );
  const weight = RULE_WEIGHTS.suspicious_tld;

  return {
    id: "suspicious_tld",
    name: "Suspicious top-level domain",
    defaultWeight: weight,

    evaluate(parsed: ParsedUrl): RuleSignal {
      const tld = parsed.publicSuffix?.toLowerCase() ?? null;
      const fired = tld !== null && tlds.has(tld);

      if (!fired) {
        return {
          id: "suspicious_tld",
          layer: "rules",
          name: "Suspicious top-level domain",
          fired: false,
          severity: "info",
          weight,
          score: 0,
          description: "Top-level domain is not on the configured suspicious list.",
          evidence: {},
        };
      }

      return {
        id: "suspicious_tld",
        layer: "rules",
        name: "Suspicious top-level domain",
        fired: true,
        severity: "low",
        weight,
        score: weight,
        description: `Top-level domain ".${tld}" is on the configured suspicious list. This is a weak signal on its own but useful in combination.`,
        evidence: {
          tld: tld ?? "",
          registrableDomain: parsed.registrableDomain ?? "",
        },
      };
    },
  };
}

export const suspiciousTldRule: Rule = createSuspiciousTldRule();

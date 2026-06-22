import type { ParsedUrl } from "../../shared/parsedUrl";
import type { RuleSignal } from "../../shared/verdict";
import type { Rule } from "../types";
import { RULE_WEIGHTS } from "../weights";
import { DEFAULT_CREDENTIAL_KEYWORDS } from "../data/credentialKeywords";

type Surface = "path" | "query" | "fragment";

export interface CredentialKeywordsOptions {
  keywords?: Iterable<string>;
}

export interface KeywordHit {
  keyword: string;
  surface: Surface;
}

function findHits(text: string, keywords: string[], surface: Surface): KeywordHit[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const out: KeywordHit[] = [];
  for (const keyword of keywords) {
    if (lower.includes(keyword)) out.push({ keyword, surface });
  }
  return out;
}

export function createCredentialKeywordsRule(
  opts: CredentialKeywordsOptions = {},
): Rule {
  const keywords = Array.from(
    new Set(
      Array.from(opts.keywords ?? DEFAULT_CREDENTIAL_KEYWORDS, (k) => k.toLowerCase()),
    ),
  );
  const weight = RULE_WEIGHTS.credential_keywords;

  return {
    id: "credential_keywords",
    name: "Credential-related keywords in URL",
    defaultWeight: weight,

    evaluate(parsed: ParsedUrl): RuleSignal {
      if (parsed.parseError) {
        return notFired(weight, "URL did not parse; cannot inspect path/query/fragment.");
      }

      const hits = [
        ...findHits(parsed.path, keywords, "path"),
        ...findHits(parsed.query, keywords, "query"),
        ...findHits(parsed.fragment, keywords, "fragment"),
      ];

      if (hits.length === 0) {
        return notFired(weight, "No credential-related keywords found in path, query, or fragment.");
      }

      const matchedKeywords = Array.from(new Set(hits.map((h) => h.keyword)));
      const matchedSurfaces = Array.from(new Set(hits.map((h) => h.surface)));

      return {
        id: "credential_keywords",
        layer: "rules",
        name: "Credential-related keywords in URL",
        fired: true,
        severity: "low",
        weight,
        score: weight,
        description: `URL contains credential-related keyword(s) (${matchedKeywords.join(", ")}). Phishing links often invite users to "login", "verify", or "update" an account.`,
        evidence: {
          matchedKeywords,
          matchedSurfaces,
        },
      };
    },
  };
}

function notFired(weight: number, description: string): RuleSignal {
  return {
    id: "credential_keywords",
    layer: "rules",
    name: "Credential-related keywords in URL",
    fired: false,
    severity: "info",
    weight,
    score: 0,
    description,
    evidence: {},
  };
}

export const credentialKeywordsRule: Rule = createCredentialKeywordsRule();

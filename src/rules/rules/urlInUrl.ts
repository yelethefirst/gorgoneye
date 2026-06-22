import type { ParsedUrl } from "../../shared/parsedUrl";
import type { RuleSignal } from "../../shared/verdict";
import type { Rule } from "../types";
import { RULE_WEIGHTS } from "../weights";

const EMBEDDED_URL_RE = /(?:https?|ftp):\/\/[^\s"'<>]+/i;

function safeDecode(value: string): string {
  if (!value || !value.includes("%")) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function findEmbeddedUrl(value: string): string | null {
  if (!value) return null;
  const direct = value.match(EMBEDDED_URL_RE);
  if (direct) return direct[0];
  const decoded = safeDecode(value);
  if (decoded !== value) {
    const fromDecoded = decoded.match(EMBEDDED_URL_RE);
    if (fromDecoded) return fromDecoded[0];
  }
  return null;
}

export const urlInUrlRule: Rule = {
  id: "url_in_url",
  name: "URL embedded inside URL",
  defaultWeight: RULE_WEIGHTS.url_in_url,

  evaluate(parsed: ParsedUrl): RuleSignal {
    const weight = RULE_WEIGHTS.url_in_url;
    if (parsed.parseError) return notFired(weight, "URL did not parse.");

    const hits: Array<{ surface: "path" | "query" | "fragment"; embedded: string }> = [];
    const inPath = findEmbeddedUrl(parsed.path);
    if (inPath) hits.push({ surface: "path", embedded: inPath });
    const inQuery = findEmbeddedUrl(parsed.query);
    if (inQuery) hits.push({ surface: "query", embedded: inQuery });
    const inFragment = findEmbeddedUrl(parsed.fragment);
    if (inFragment) hits.push({ surface: "fragment", embedded: inFragment });

    if (hits.length === 0) {
      return notFired(weight, "No embedded URL found in path, query, or fragment.");
    }

    const first = hits[0]!;
    return {
      id: "url_in_url",
      layer: "rules",
      name: "URL embedded inside URL",
      fired: true,
      severity: "medium",
      weight,
      score: weight,
      description: `URL contains another URL inside its ${first.surface}. Open redirects and obfuscation links commonly embed a destination URL this way.`,
      evidence: {
        embeddedUrl: first.embedded,
        embeddedSurface: first.surface,
        surfacesWithEmbeddedUrl: hits.map((h) => h.surface),
      },
    };
  },
};

function notFired(weight: number, description: string): RuleSignal {
  return {
    id: "url_in_url",
    layer: "rules",
    name: "URL embedded inside URL",
    fired: false,
    severity: "info",
    weight,
    score: 0,
    description,
    evidence: {},
  };
}

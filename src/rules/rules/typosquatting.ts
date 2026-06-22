import levenshtein from "fast-levenshtein";
import type { ParsedUrl } from "../../shared/parsedUrl";
import type { RuleSignal } from "../../shared/verdict";
import type { Rule } from "../types";
import { RULE_WEIGHTS } from "../weights";
import { PROTECTED_BRANDS, type ProtectedBrand } from "../data/brandDomains";

interface BrandEntry {
  brand: string;
  domain: string;
  sld: string;
}

function sldOf(domain: string): string {
  const dot = domain.indexOf(".");
  return dot > 0 ? domain.slice(0, dot) : domain;
}

// Precomputed at module load so per-evaluation cost is just N short Levenshtein computations.
const BRAND_ENTRIES: BrandEntry[] = PROTECTED_BRANDS.flatMap((b: ProtectedBrand) =>
  b.domains.map((domain) => ({ brand: b.brand, domain, sld: sldOf(domain) })),
);
const KNOWN_DOMAINS = new Set(BRAND_ENTRIES.map((e) => e.domain));

interface Match {
  brand: string;
  brandDomain: string;
  candidateSld: string;
  brandSld: string;
  distance: number;
}

function thresholdFor(a: string, b: string): number {
  return Math.min(a.length, b.length) <= 5 ? 1 : 2;
}

function bestMatch(candidateSld: string): Match | null {
  let best: Match | null = null;
  for (const entry of BRAND_ENTRIES) {
    // Skip when lengths are too different for any plausible threshold.
    if (Math.abs(entry.sld.length - candidateSld.length) > 2) continue;
    const distance = levenshtein.get(candidateSld, entry.sld);
    if (distance === 0) continue; // exact SLD match: handled by KNOWN_DOMAINS guard below
    if (best === null || distance < best.distance) {
      best = {
        brand: entry.brand,
        brandDomain: entry.domain,
        candidateSld,
        brandSld: entry.sld,
        distance,
      };
    }
  }
  return best;
}

function extractCandidateSld(parsed: ParsedUrl): string | null {
  if (!parsed.registrableDomain) return null;
  if (parsed.publicSuffix && parsed.registrableDomain.endsWith(`.${parsed.publicSuffix}`)) {
    return parsed.registrableDomain.slice(0, -parsed.publicSuffix.length - 1);
  }
  return sldOf(parsed.registrableDomain);
}

export const typosquattingRule: Rule = {
  id: "typosquatting",
  name: "Typosquatting brand impersonation",
  defaultWeight: RULE_WEIGHTS.typosquatting,

  evaluate(parsed: ParsedUrl): RuleSignal {
    const weight = RULE_WEIGHTS.typosquatting;
    const notFired: RuleSignal = {
      id: "typosquatting",
      layer: "rules",
      name: "Typosquatting brand impersonation",
      fired: false,
      severity: "info",
      weight,
      score: 0,
      description: "Registrable domain does not look like a typo of a known brand.",
      evidence: {},
    };

    if (!parsed.registrableDomain || parsed.isIpAddress) return notFired;
    if (KNOWN_DOMAINS.has(parsed.registrableDomain)) return notFired;

    const candidateSld = extractCandidateSld(parsed);
    if (!candidateSld || candidateSld.length < 3) return notFired;

    const match = bestMatch(candidateSld);
    if (!match) return notFired;

    const threshold = thresholdFor(match.candidateSld, match.brandSld);
    if (match.distance > threshold) return notFired;

    return {
      id: "typosquatting",
      layer: "rules",
      name: "Typosquatting brand impersonation",
      fired: true,
      severity: "high",
      weight,
      score: weight,
      description: `Domain "${parsed.registrableDomain}" is ${match.distance} edit(s) away from "${match.brandDomain}" (${match.brand}). This is a common phishing pattern.`,
      evidence: {
        candidateDomain: parsed.registrableDomain,
        candidateSld: match.candidateSld,
        matchedBrand: match.brand,
        matchedBrandDomain: match.brandDomain,
        editDistance: match.distance,
      },
    };
  },
};

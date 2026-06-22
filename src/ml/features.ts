import type { ParsedUrl } from "../shared/parsedUrl";
import { FEATURE_COUNT, FEATURE_INDEX } from "./featureSchema";
import {
  DEFAULT_CREDENTIAL_KEYWORDS,
} from "../rules/data/credentialKeywords";
import { PROTECTED_BRANDS } from "../rules/data/brandDomains";
import levenshtein from "fast-levenshtein";

const CREDENTIAL_KEYWORDS = DEFAULT_CREDENTIAL_KEYWORDS.map((k) => k.toLowerCase());

const BRAND_SLDS: string[] = (() => {
  const set = new Set<string>();
  for (const b of PROTECTED_BRANDS) {
    for (const d of b.domains) {
      const dot = d.indexOf(".");
      set.add(dot > 0 ? d.slice(0, dot) : d);
    }
  }
  return Array.from(set);
})();

const SYMBOL_RE = /[!@#$%^&*()_+\-={}[\]|\\:;"'<>,.?/~`]/g;
const DIGIT_RE = /[0-9]/g;
const HYPHEN_RE = /-/g;
const DOT_RE = /\./g;
const PERCENT_ENC_RE = /%[0-9a-fA-F]{2}/g;

function countMatches(input: string, re: RegExp): number {
  return (input.match(re) ?? []).length;
}

function shannonEntropy(input: string): number {
  if (input.length === 0) return 0;
  const freq = new Map<string, number>();
  for (const ch of input) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  const len = input.length;
  let h = 0;
  for (const count of freq.values()) {
    const p = count / len;
    h -= p * Math.log2(p);
  }
  return h;
}

function digitRatio(input: string): number {
  if (input.length === 0) return 0;
  return countMatches(input, DIGIT_RE) / input.length;
}

function extractSld(parsed: ParsedUrl): string | null {
  if (!parsed.registrableDomain) return null;
  if (parsed.publicSuffix && parsed.registrableDomain.endsWith(`.${parsed.publicSuffix}`)) {
    return parsed.registrableDomain.slice(0, -parsed.publicSuffix.length - 1);
  }
  const dot = parsed.registrableDomain.indexOf(".");
  return dot > 0 ? parsed.registrableDomain.slice(0, dot) : parsed.registrableDomain;
}

function minBrandEditDistance(parsed: ParsedUrl): number {
  const sld = extractSld(parsed);
  if (!sld || sld.length < 3 || parsed.isIpAddress) return -1;
  let best = -1;
  for (const brandSld of BRAND_SLDS) {
    if (sld === brandSld) return 0;
    if (Math.abs(brandSld.length - sld.length) > 3) continue;
    const d = levenshtein.get(sld, brandSld);
    if (best === -1 || d < best) best = d;
  }
  return best;
}

function hasEmbeddedUrl(parsed: ParsedUrl): boolean {
  const haystack = `${parsed.path} ${parsed.query} ${parsed.fragment}`;
  if (/https?:\/\//i.test(haystack)) return true;
  if (/https?%3A%2F%2F/i.test(haystack)) return true;
  return false;
}

function hasUserinfo(originalUrl: string): boolean {
  const schemeEnd = originalUrl.indexOf("://");
  if (schemeEnd === -1) return false;
  const afterScheme = originalUrl.slice(schemeEnd + 3);
  const at = afterScheme.indexOf("@");
  if (at === -1) return false;
  const pathStart = afterScheme.search(/[/?#]/);
  return pathStart === -1 || at < pathStart;
}

function credentialKeywordHits(parsed: ParsedUrl): { count: number; any: boolean } {
  const text = `${parsed.path} ${parsed.query} ${parsed.fragment}`.toLowerCase();
  let count = 0;
  for (const kw of CREDENTIAL_KEYWORDS) {
    if (text.includes(kw)) count += 1;
  }
  return { count, any: count > 0 };
}

function bucketLong(length: number, threshold: number): number {
  return length > threshold ? 1 : 0;
}

/**
 * Extracts a fixed-order, fixed-length feature vector from a `ParsedUrl`.
 *
 * Order MUST match `FEATURE_NAMES` in `featureSchema.ts`. The output is a
 * `Float32Array` so it can be passed directly to ONNX Runtime Web without
 * a copy.
 *
 * This function is deterministic, allocation-light, and runs in well under
 * 5 ms per URL (perf test in `tests/ml/features.perf.test.ts`).
 */
export function extractFeatures(parsed: ParsedUrl): Float32Array {
  const out = new Float32Array(FEATURE_COUNT);
  const url = parsed.originalUrl;
  const host = parsed.hostname ?? "";

  const urlLength = url.length;
  const hostLength = host.length;
  const pathLength = parsed.path.length;
  const queryLength = parsed.query.length;
  const fragmentLength = parsed.fragment.length;

  out[FEATURE_INDEX.url_length] = urlLength;
  out[FEATURE_INDEX.hostname_length] = hostLength;
  out[FEATURE_INDEX.path_length] = pathLength;
  out[FEATURE_INDEX.query_length] = queryLength;
  out[FEATURE_INDEX.fragment_length] = fragmentLength;

  out[FEATURE_INDEX.dot_count] = countMatches(url, DOT_RE);
  out[FEATURE_INDEX.hyphen_count] = countMatches(url, HYPHEN_RE);
  out[FEATURE_INDEX.digit_count] = countMatches(url, DIGIT_RE);
  out[FEATURE_INDEX.symbol_count] = countMatches(url, SYMBOL_RE);
  out[FEATURE_INDEX.percent_encoded_count] = countMatches(url, PERCENT_ENC_RE);

  out[FEATURE_INDEX.subdomain_depth] = parsed.subdomain
    ? parsed.subdomain.split(".").filter(Boolean).length
    : 0;
  out[FEATURE_INDEX.is_ip_address] = parsed.isIpAddress ? 1 : 0;
  out[FEATURE_INDEX.is_punycode] = parsed.isPunycode ? 1 : 0;
  out[FEATURE_INDEX.is_idn] = parsed.isIdn ? 1 : 0;
  out[FEATURE_INDEX.is_https] = parsed.scheme === "https" ? 1 : 0;

  const credHits = credentialKeywordHits(parsed);
  out[FEATURE_INDEX.has_credential_keyword] = credHits.any ? 1 : 0;
  out[FEATURE_INDEX.credential_keyword_count] = credHits.count;

  out[FEATURE_INDEX.has_embedded_url] = hasEmbeddedUrl(parsed) ? 1 : 0;
  out[FEATURE_INDEX.at_in_url_userinfo] = hasUserinfo(parsed.originalUrl) ? 1 : 0;

  out[FEATURE_INDEX.min_brand_edit_distance] = minBrandEditDistance(parsed);

  out[FEATURE_INDEX.host_digit_ratio] = digitRatio(host);
  out[FEATURE_INDEX.host_entropy] = shannonEntropy(host);
  out[FEATURE_INDEX.path_entropy] = shannonEntropy(parsed.path);

  out[FEATURE_INDEX.url_length_bucket_long] = bucketLong(urlLength, 100);
  out[FEATURE_INDEX.url_length_bucket_very_long] = bucketLong(urlLength, 200);

  return out;
}

/** Convenience for parity test fixtures — emits a plain `Record<name, number>`. */
export function extractFeaturesByName(parsed: ParsedUrl): Record<string, number> {
  const vec = extractFeatures(parsed);
  const out: Record<string, number> = {};
  for (let i = 0; i < FEATURE_COUNT; i += 1) {
    out[Object.keys(FEATURE_INDEX)[i]!] = vec[i]!;
  }
  return out;
}

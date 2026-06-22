/**
 * Frozen feature schema for the local URL classifier (Epic 3).
 *
 * Order is a release contract. The TypeScript extractor in
 * `src/ml/features.ts` and the Python pipeline in `training/` MUST emit
 * features in this exact order, with these exact names. The parity-snapshot
 * test in `tests/ml/features.snapshot.test.ts` pins one frozen vector per
 * fixture URL so that any drift on either side fails the build.
 *
 * `FEATURE_SCHEMA_VERSION` is bumped whenever a feature is added, removed,
 * or its semantics change. Bump it together with the Python feature script
 * and the snapshot JSON in `tests/ml/__snapshots__/`.
 */
export const FEATURE_SCHEMA_VERSION = "1.0.0";

export const FEATURE_NAMES = [
  // Length / structural
  "url_length",
  "hostname_length",
  "path_length",
  "query_length",
  "fragment_length",
  // Counts on raw URL string
  "dot_count",
  "hyphen_count",
  "digit_count",
  "symbol_count",
  "percent_encoded_count",
  // Hostname structure
  "subdomain_depth",
  "is_ip_address",
  "is_punycode",
  "is_idn",
  "is_https",
  // Path / query keywords
  "has_credential_keyword",
  "credential_keyword_count",
  // URL-in-URL / redirect indicators
  "has_embedded_url",
  "at_in_url_userinfo",
  // Brand / typosquat
  "min_brand_edit_distance",
  // Statistical
  "host_digit_ratio",
  "host_entropy",
  "path_entropy",
  // Length buckets (saturating to keep features bounded)
  "url_length_bucket_long",
  "url_length_bucket_very_long",
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];

export const FEATURE_COUNT = FEATURE_NAMES.length;

/**
 * Index lookup for tests and any analyst code that wants to read a vector
 * positionally without re-deriving the order.
 */
export const FEATURE_INDEX: Record<FeatureName, number> = Object.fromEntries(
  FEATURE_NAMES.map((name, i) => [name, i]),
) as Record<FeatureName, number>;

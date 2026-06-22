# Feature schema (`FEATURE_SCHEMA_VERSION = 1.0.0`)

This file is the **release contract** between the TypeScript feature
extractor in [`src/ml/features.ts`](../src/ml/features.ts) and the Python
training pipeline that will land with AEG-3-1 → AEG-3-4. Any change to a
feature here (added / removed / renamed / semantics shifted) requires:

1. Editing [`src/ml/featureSchema.ts`](../src/ml/featureSchema.ts) on the
   TypeScript side.
2. Editing the Python feature script under `training/` once it exists.
3. Bumping `FEATURE_SCHEMA_VERSION` in both places.
4. Regenerating the parity snapshot in
   [`tests/ml/__snapshots__/featureParity.json`](../tests/ml/__snapshots__/featureParity.json).

The TypeScript extractor returns features as a `Float32Array` in the order
listed below. Python must emit the same order with the same column names.

## Schema

| # | Name | Type | Description |
| --- | --- | --- | --- |
| 0 | `url_length` | int | Length of `originalUrl` in characters. |
| 1 | `hostname_length` | int | Length of `parsed.hostname` (0 if absent). |
| 2 | `path_length` | int | Length of `parsed.path`. |
| 3 | `query_length` | int | Length of `parsed.query` (without the leading `?`). |
| 4 | `fragment_length` | int | Length of `parsed.fragment` (without the leading `#`). |
| 5 | `dot_count` | int | Count of `.` characters in the raw URL. |
| 6 | `hyphen_count` | int | Count of `-` characters in the raw URL. |
| 7 | `digit_count` | int | Count of ASCII digits in the raw URL. |
| 8 | `symbol_count` | int | Count of ASCII symbol characters in the raw URL (`!@#$%^&*()_+-={}[]|\:;"'<>,.?/~``). |
| 9 | `percent_encoded_count` | int | Number of `%XX` percent-encoded sequences in the raw URL. |
| 10 | `subdomain_depth` | int | Number of labels in `parsed.subdomain` (0 if none). |
| 11 | `is_ip_address` | 0/1 | 1 if the hostname is an IPv4 or IPv6 literal. |
| 12 | `is_punycode` | 0/1 | 1 if any hostname label starts with `xn--`. |
| 13 | `is_idn` | 0/1 | 1 if the hostname contains non-ASCII characters or is punycode. |
| 14 | `is_https` | 0/1 | 1 if the scheme is `https`. |
| 15 | `has_credential_keyword` | 0/1 | 1 if any credential keyword appears in path/query/fragment (see [`credentialKeywords.ts`](../src/rules/data/credentialKeywords.ts)). |
| 16 | `credential_keyword_count` | int | Distinct credential keywords matched. |
| 17 | `has_embedded_url` | 0/1 | 1 if path/query/fragment contains another `http(s)://` (raw or percent-encoded). |
| 18 | `at_in_url_userinfo` | 0/1 | 1 if the URL has a userinfo segment (`scheme://userinfo@host`). |
| 19 | `min_brand_edit_distance` | int | Smallest Levenshtein distance from the host's SLD to any [protected brand](../src/rules/data/brandDomains.ts) SLD. `-1` if the URL is an IP literal, has no registrable domain, or the SLD is shorter than 3 chars. `0` for an exact brand match. |
| 20 | `host_digit_ratio` | float | Digits ÷ hostname length. 0 if hostname is empty. |
| 21 | `host_entropy` | float | Shannon entropy of the hostname (base 2). 0 if hostname is empty. |
| 22 | `path_entropy` | float | Shannon entropy of the path (base 2). 0 if path is empty. |
| 23 | `url_length_bucket_long` | 0/1 | 1 if URL length > 100. |
| 24 | `url_length_bucket_very_long` | 0/1 | 1 if URL length > 200. |

**Total: 25 features.** `FEATURE_COUNT` in `src/ml/featureSchema.ts` is the
single source of truth.

## How Python validates parity

Once the Python pipeline lands, it must include a regression test that:

1. Loads every URL listed in `tests/ml/__snapshots__/featureParity.json`
   (`{"url": "...", "features": {...}}` per row).
2. Runs the Python `extract_features(url)` over each.
3. Asserts every column matches the snapshot to within `1e-6` (allowing for
   float32 vs float64 noise).

If anything diverges, **do not** auto-update the snapshot. Investigate which
implementation drifted and fix that one.

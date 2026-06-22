# Detection Pipeline

## Pipeline Contract

The detection pipeline accepts a URL and minimal context, then returns a structured verdict:

- `safe`
- `suspicious`
- `phishing`
- `unknown`

Every verdict must include:

- Overall confidence from `0` to `1`.
- Per-layer scores.
- Fired signals.
- Human-readable evidence.
- Privacy behavior summary.
- Timing metadata.
- Any unavailable layers and why they were unavailable.

The pipeline must never rely on a hidden score that users cannot inspect.

## Layer Order

The layers are ordered by cost and privacy sensitivity:

1. Rule-based URL analysis: cheapest, deterministic, local.
2. Local ML classifier: local, slightly more expensive.
3. Safe Browsing hash-prefix threat intelligence: external but privacy-preserving.
4. Fusion and immediate verdict UI.
5. Optional explanation: local template or local LLM.
6. Optional visual inspection: consent-gated because it may contact the target origin.

The original guide listed the LLM as Layer 3 and Safe Browsing as Layer 4. Implementation should treat explanation as a post-verdict layer, not as a blocking detector. Safe Browsing should run in parallel with ML because it can materially change the verdict.

## Layer 1: Rule-Based URL Analysis

Purpose:

- Catch obvious malicious URLs quickly.
- Provide interpretable evidence for the user and the LLM/template explanation.
- Produce baseline signals even when ML or threat-intelligence services are unavailable.

Rules:

| Rule | Signal | Default Weight | Notes |
| --- | --- | --- | --- |
| IP hostname | URL host is IPv4 or IPv6 literal | 0.70 | Strong phishing signal, but not always malicious. |
| Punycode | Domain contains `xn--` label | 0.55 | Explain decoded domain if safe to display. |
| Mixed script | Domain mixes visually confusable scripts | 0.60 | Requires careful Unicode handling. |
| Typosquatting | Edit distance to protected brand domain is small | 0.75 | Must not flag exact legitimate domain. |
| Suspicious TLD | TLD in configured risk list | 0.35 | Weak alone; useful in combination. |
| Excessive subdomains | More than configured threshold | 0.35 | Show eTLD+1 clearly in UI. |
| Credential keywords | Path/query contains login, verify, secure, update, suspend, account | 0.30 | Weak alone; useful with brand/redirect signals. |
| Embedded credentials | URL contains username/password or `@` tricks | 0.80 | Strong signal. |
| URL-in-URL | Query or path contains another URL | 0.45 | Common redirect/obfuscation pattern. |
| Excessive length/encoding | Long URL, high percent-encoding, high entropy | 0.35 | Feed into ML too. |

Implementation requirements:

- Use `new URL()` plus `tldts` for parsing.
- Keep a typed `ParsedUrl` object.
- Do not parse URLs with regex alone.
- Keep rule metadata stable for UI and explanations.
- Unit-test malformed URLs, IDNs, IPs, `javascript:`, `data:`, and redirect patterns.

## Layer 2: Local ML Classifier

Purpose:

- Learn combinations of features that simple heuristics miss.
- Produce a probability score that improves final confidence.
- Keep all inference local.

Recommended model:

- XGBoost or LightGBM trained offline.
- Exported to ONNX.
- Executed through `onnxruntime-web` in a worker.
- Model target size under 5 MB for initial MVP.

Feature groups:

- URL length, hostname length, path length, query length.
- Dot, hyphen, digit, symbol, and percent-encoding counts.
- Subdomain depth and eTLD+1 properties.
- IP-host and punycode flags.
- Suspicious keyword counts.
- Entropy and digit ratio.
- Redirect URL-in-URL indicators.
- Brand-edit-distance minimum.
- HTTPS scheme flag.
- Optional offline-enriched features such as known brand domain, domain age bucket, or certificate age bucket if available without live user lookup.

Critical technical requirement:

The Python training feature order and TypeScript inference feature order must be identical. The project needs snapshot tests where the same 100 URLs produce matching feature arrays in Python and TypeScript.

## Layer 3: Safe Browsing Hash-Prefix Threat Intelligence

Purpose:

- Benefit from global threat intelligence without sending full URLs.
- Catch known phishing URLs missed by rules or ML.

Implementation model:

- Prefer Safe Browsing Update API style local hash-prefix database.
- Canonicalize URL using the documented Safe Browsing canonicalization process.
- Hash locally with SHA-256.
- Compare local prefix data first.
- Request full hashes only for matching prefixes.
- Perform final full-hash comparison locally.

Privacy requirement:

- Never use an API mode that sends the full URL.
- Never include the URL in query params, request body, logs, error messages, telemetry, or audit export.
- Audit records should show only destination, data category, byte count, and purpose.

## Layer 4: Fusion Engine

Purpose:

- Combine evidence into a stable user-facing verdict.
- Avoid single weak signals causing high-confidence phishing verdicts.
- Preserve all layer evidence for transparency.

Initial scoring policy:

| Input | Suggested Default |
| --- | --- |
| Rule score weight | 0.35 |
| ML probability weight | 0.45 |
| Safe Browsing match weight | 0.90 deterministic signal |
| Visual impersonation weight | 0.85 when enabled |
| Safe threshold | `< 0.30` |
| Suspicious threshold | `0.30` to `0.74` |
| Phishing threshold | `>= 0.75` |

Decision rules:

- Confirmed Safe Browsing malicious match sets verdict to at least `suspicious`.
- Multiple strong independent signals can elevate to `phishing`.
- Single weak signal should normally produce `suspicious`, not `phishing`.
- Missing optional layers reduce confidence explanation quality but should not be counted as safe evidence.
- The engine must include `unavailableLayers` so the UI can show what was skipped.

## Layer 5: Explanation

Purpose:

- Convert structured evidence into clear user guidance.
- Increase user trust without sending sensitive data to cloud AI.

Default:

- Deterministic templates from fired signals.

Optional:

- Local WebLLM explanation.

Prompt constraints:

- Include only structured signals, verdict, confidence, and safe display domains.
- Do not include email body, sender identity, recipient identity, or raw headers.
- Instruct the model not to invent facts.
- Limit output to 2 or 3 sentences.
- Use a max token budget.
- Always fall back to templates.

## Layer 6: Optional Visual Brand Impersonation

Purpose:

- Catch pages that visually impersonate known login pages even when URLs are borderline.

Privacy correction:

Rendering a remote page can disclose a request to the remote host. Therefore visual inspection must not automatically fetch unopened email links by default. It should be one of:

- User-consented "Inspect in sandbox" action.
- Analysis of a page the user already loaded.
- Analysis of a local/demo fixture.
- Enterprise-managed mode with explicit policy notice.

Implementation constraints:

- Use an offscreen document with strict CSP.
- Avoid executing suspect-page scripts.
- Avoid loading third-party resources where possible.
- Compute screenshot and pHash locally.
- Compare against a bundled legitimate-brand hash database.
- Never upload screenshots.

## Caching

Cache key:

- SHA-256 of canonical URL, stored locally.

Cache value:

- Verdict.
- Confidence.
- Layer outputs.
- Timestamp.
- Detection-version metadata.

Default TTL:

- 24 hours for verdicts.
- Shorter for suspicious or unknown if desired.

Do not cache:

- Raw email content.
- Raw screenshots.
- Raw LLM prompts with sensitive content.

## Timeouts

Suggested budgets:

| Operation | Budget |
| --- | --- |
| URL normalization | 2 ms |
| Rule engine | 10 ms |
| ML feature extraction | 5 ms |
| ONNX inference | 200 ms |
| Safe Browsing hash-prefix lookup | 300 ms network-dependent |
| Fusion | 5 ms |
| Template explanation | 20 ms |
| Local LLM explanation | User-requested, non-blocking |
| Visual inspection | User-requested, non-blocking |

The UI should show provisional results if slow layers are still running, then update when additional evidence arrives.

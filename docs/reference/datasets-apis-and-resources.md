# Datasets, APIs, And Resources

This document lists external resources needed for implementation. Verify license terms and current API behavior before production use.

## Training Datasets

| Resource | Use | Notes |
| --- | --- | --- |
| PhishTank | Verified phishing URLs | Check current terms before storing or redistributing data. |
| OpenPhish | Supplementary phishing feed | Free/community access may be limited. |
| Tranco | Legitimate-domain baseline | Use for legitimate examples and protected-brand candidates. |
| UCI phishing datasets | Baseline feature ideas | Useful for early experiments; may not reflect current attacks. |
| Internal fixtures | Tests and demo | Prefer `.test` domains and sanitized HTML. |

Dataset rules:

- Track source and acquisition date.
- Do not commit raw feeds unless licensing permits.
- Keep a deterministic fixture set separate from training data.
- Avoid training on the exact demo set.
- Keep personally identifiable data out of datasets.

## APIs

| API | Use | Privacy Requirement |
| --- | --- | --- |
| Google Safe Browsing hash APIs | Threat-intelligence lookup | Use hash-prefix flow, never full URL lookup. |
| RDAP | Optional offline domain-age enrichment | Do not run live per-user lookups by default because they disclose domains. |
| Certificate Transparency sources | Optional offline enrichment | Prefer offline enrichment for model features. |
| urlscan.io | Demo research only | Do not call from production extension with user URLs. |

## Core Libraries

| Library | Use |
| --- | --- |
| WXT | Browser-extension scaffold and build. |
| React | Popup, options, onboarding, verdict detail UI. |
| Tailwind CSS | Styling. |
| tldts | URL/domain parsing. |
| fast-levenshtein | Typosquatting distance. |
| idb | IndexedDB wrapper. |
| onnxruntime-web | Browser ML inference. |
| WebLLM | Optional local LLM. |
| blockhash-js | Optional perceptual hash implementation. |
| Vitest | Unit and integration tests. |
| Playwright | Browser extension E2E tests. |

## Security And Privacy References

Topics to review:

- Browser extension Manifest V3 service-worker lifecycle.
- Chrome extension Content Security Policy.
- Chrome offscreen documents.
- Safe Browsing hash-prefix behavior and canonicalization requirements.
- Unicode security and IDN homograph attacks.
- SPF, DKIM, and DMARC interpretation.
- Phishing URL feature-engineering literature.
- OWASP guidance for browser extension security where applicable.

## Demo Resources

Use:

- Local Gmail-like HTML fixture.
- Safe Browsing vendor test URL where supported.
- Sanitized fake phishing examples on `.test` domains.
- Locally hosted brand impersonation fixture for visual inspection demo.

Avoid:

- Live phishing URLs on stage.
- Real customer or personal emails.
- Real credentials.
- Uploading suspicious URLs to third-party scanners during demo.

## Asset Governance

Model artifacts:

- Store under `public/models/`.
- Include SHA-256 hash.
- Include model metadata JSON.
- Document training dataset version.

Brand lists:

- Store under `public/data/`.
- Track source and generation date.
- Keep allowlisted legitimate domains explicit.

Screenshots:

- Do not commit screenshots of real login pages unless usage rights are clear.
- Prefer generated or local fixture pages for tests.

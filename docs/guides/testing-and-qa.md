# Testing And QA Guide

## Test Pyramid

| Layer | Tool | Purpose |
| --- | --- | --- |
| Unit | Vitest | URL parsing, rules, fusion, storage, audit, prompt building. |
| Parity | Vitest plus Python fixture generation | Python/TypeScript ML feature parity. |
| Model | Python tests and browser worker tests | ONNX round-trip and browser inference. |
| Integration | Vitest with mocked extension APIs | Background orchestration, message bus, cache. |
| E2E | Playwright | Extension loaded in Chromium, fixture page, badge rendering. See [`e2e-testing.md`](e2e-testing.md) for the runbook. |
| Privacy | Vitest and in-product verifier | No forbidden data in network payloads. |
| Performance | Vitest or custom runner | P50/P95 latency budget. |
| Manual | Checklist | Real Gmail, browser compatibility, demo rehearsal. |

## Unit Test Scope

Rules:

- IP hostnames.
- Punycode.
- Mixed-script detection.
- Typosquatting.
- Suspicious TLDs.
- Credential keywords.
- Embedded credentials.
- URL-in-URL.
- Excessive length and encoding.

Fusion:

- Single weak signal stays suspicious.
- Multiple strong signals become phishing.
- Safe Browsing match elevates verdict.
- Missing optional layers do not count as safe.
- Confidence stays in `0` to `1`.

Storage:

- Settings get/set.
- Verdict cache TTL.
- Audit log TTL.
- Clear-cache behavior.

Privacy:

- Prompt builder rejects raw email content fields.
- Audited fetch records data categories.
- Network tests fail on forbidden strings.

## Fixture Strategy

Use deterministic fixtures:

```text
tests/fixtures/
  urls.safe.json
  urls.phishing.json
  urls.suspicious.json
  gmail-message.html
  outlook-message.html
  ml-feature-parity.json
  privacy-email.json
```

Avoid live phishing URLs in committed tests. Prefer:

- `example.com`, `example.net`, and `example.org` for neutral examples.
- Reserved `.test` domains.
- Vendor-provided Safe Browsing test URLs where required.
- Local HTML pages that visually mimic login pages without using real credentials or live phishing infrastructure.

## Performance Tests

Measure:

- URL normalization.
- Rule engine.
- Feature extraction.
- ONNX inference.
- Fusion.
- Total analysis excluding optional LLM and visual inspection.

Budgets:

- Rule engine under 10 ms per URL.
- Feature extraction under 5 ms per URL.
- ML inference 50 to 200 ms target.
- End-to-end P50 under 100 ms.
- End-to-end P95 under 300 ms.
- Popup initial render under 200 ms.

Performance output should include:

- Machine profile.
- Browser version.
- Number of URLs.
- P50, P90, P95, max.
- Failed budget, if any.

## E2E Test Requirements

The first E2E test should:

1. Build the extension.
2. Launch Chromium with the extension loaded.
3. Open a local Gmail-like fixture page.
4. Wait for content script injection.
5. Assert badges render beside links.
6. Click a badge.
7. Assert popup/detail surface shows the expected verdict.
8. Assert no forbidden network calls occurred.

Do not depend on logging into a real Gmail account in CI.

## Manual Smoke Checklist

Before demo:

- Extension installs cleanly.
- Popup opens.
- Options page opens.
- Gmail fixture badges render.
- Real Gmail manual test works if using a real account.
- Generic hover scanner works on a local fixture.
- Rules detect typosquat fixture.
- ML model loads.
- Safe Browsing test path works or is cleanly disabled.
- Privacy verifier passes.
- Template explanation works.
- LLM explanation works on demo hardware if included.
- Visual inspection consent prompt appears if included.
- Clear-cache button works.
- Browser reload does not break service-worker state.

## Bug Severity

P0:

- Email content or full URL leaks in default flow.
- Extension cannot load.
- Gmail demo path broken.
- Verdicts never appear.
- Known phishing fixture marked safe with no explanation.

P1:

- ML unavailable without fallback.
- Privacy audit missing records.
- Badges overlap Gmail UI.
- Performance budget fails significantly.

P2:

- Cosmetic issues.
- Optional layer disabled.
- Non-critical copy or animation issue.

## Release Checklist

- `pnpm lint`.
- `pnpm typecheck`.
- `pnpm test`.
- `pnpm test:privacy`.
- `pnpm test:perf`.
- `pnpm test:e2e`.
- Manual smoke checklist.
- README updated.
- ADRs updated if decisions changed.
- Risk register reviewed.

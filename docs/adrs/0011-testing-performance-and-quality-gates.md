# ADR-0011: Testing, Performance, And Quality Gates

## Status

Accepted

## Context

The product touches security, privacy, browser integrations, ML, and UI. A demo can fail in multiple ways: wrong verdict, slow verdict, broken Gmail selectors, missing model, accidental privacy leak, or browser-specific issue.

## Decision

Use layered quality gates:

- Unit tests for URL parsing, rules, fusion, storage, audit, and prompt building.
- Python-to-TypeScript feature parity tests for ML.
- ONNX round-trip tests.
- Playwright E2E tests with local email fixtures.
- Privacy-verifier tests that inspect network payloads.
- Performance tests for URL analysis.
- Manual cross-browser smoke tests before demo or release.

Performance budgets:

- P50 analysis under 100 ms excluding optional LLM and visual inspection.
- P95 analysis under 300 ms excluding optional LLM and visual inspection.
- Popup loads under 200 ms.

## Consequences

Benefits:

- Reduces demo risk.
- Makes privacy claims testable.
- Catches Gmail integration regressions.
- Keeps ML feature extraction honest.

Costs:

- More setup work before feature development feels fast.
- E2E tests can be brittle if they target live webmail instead of fixtures.
- Performance budgets require stable test data and hardware notes.

## Alternatives Considered

Manual-only QA:

- Faster initially, but too risky for security and privacy claims.

Model accuracy only:

- Incomplete because product quality depends on integration, latency, explanation, and privacy.

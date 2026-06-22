# Risk Register

This register captures known product, technical, security, privacy, and delivery risks. Review it before each milestone.

## Risk Ratings

Likelihood:

- Low
- Medium
- High

Impact:

- Low
- Medium
- High
- Critical

## Active Risks

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- |
| R-001 | Privacy claim becomes inaccurate because a feature sends full URLs or content. | Medium | Critical | Central audited network wrapper; privacy tests; ADRs; verifier. | Tech lead |
| R-002 | Safe Browsing implemented with full-URL lookup by mistake. | Medium | Critical | ADR-0006; wrapper tests fail on full URL; code review checklist. | Threat-intel owner |
| R-003 | Visual inspection contacts phishing host without user consent. | Medium | High | Disabled by default; consent UI; audit record; tests. | Visual owner |
| R-004 | Gmail DOM changes break link extraction. | High | High | Local fixtures; manual smoke; generic hover fallback. | Email integration owner |
| R-005 | WebLLM fails on demo hardware. | Medium | Medium | Template fallback; preflight hardware test; model preload. | UI/LLM owner |
| R-006 | ONNX model too large or slow. | Medium | Medium | Size budget; worker inference; smaller XGBoost baseline. | ML owner |
| R-007 | Python and TypeScript feature extraction drift. | High | High | Feature parity snapshots; schema versioning. | ML owner |
| R-008 | False positives reduce trust. | Medium | High | Suspicious vs phishing distinction; threshold calibration; curated legitimate set. | Detection owner |
| R-009 | Live demo depends on unstable internet. | Medium | High | Offline fixtures; fallback video; local rules/ML path. | Demo owner |
| R-010 | API key leaks into repository. | Low | High | `.env.local`; secret scanning; review; no keys in docs. | All |
| R-011 | Extension store rejects remote model/code behavior. | Medium | Medium | Treat models as data; avoid remote executable code; package model for MVP if needed. | Release owner |
| R-012 | Content script collects too much page data. | Medium | High | Minimal URL context contract; tests; code review checklist. | Email integration owner |
| R-013 | Audit logs expose sensitive browsing history on shared devices. | Medium | Medium | Short TTL; hashed cache keys; clear-cache UI; local-only storage. | Privacy owner |
| R-014 | Model metrics are overstated. | Medium | High | Separate test set; publish methodology; avoid claims until measured. | ML owner |
| R-015 | Header authentication signals are unreliable in webmail UI. | Medium | Medium | Treat as optional; show `not_available`; do not infer pass from absence. | Email integration owner |

## Risk Review Checklist

Before building a feature:

- Does it need raw email body text?
- Does it need full scanned URL outside local memory?
- Does it create a new network call?
- Can the audit log describe it accurately?
- Can the user disable it?
- Can tests prove it does not leak forbidden data?

Before demo:

- Are optional risky features disabled unless intentionally demoed?
- Has the privacy verifier passed?
- Are fixture URLs deterministic?
- Is the fallback recording ready?
- Are measured model metrics available, or are claims worded as targets?

## Decision Triggers

Create a new ADR if:

- A feature sends any new data category off device.
- A dependency changes the runtime or privacy model.
- Detection thresholds change materially.
- The project adds a backend service.
- The model update process changes.

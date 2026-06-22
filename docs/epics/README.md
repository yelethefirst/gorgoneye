# Epics

The implementation backlog is organized into 12 epics. Each epic creates a demoable slice of the product and maps back to the architecture and ADRs.

## Epic Summary

| Epic | Title | Outcome |
| --- | --- | --- |
| 1 | Project foundation and extension scaffold | Loadable WXT extension, message bus, storage, CI baseline. |
| 2 | Layer 1 rules engine | Fast local URL heuristics with interpretable signals. |
| 3 | Layer 2 local ML classifier | Offline-trained ONNX model running in browser worker. |
| 4 | Explanation layer | Template explanations and optional local WebLLM. |
| 5 | Privacy-preserving threat intelligence | Safe Browsing hash-prefix lookup with audit records. |
| 6 | Visual brand impersonation | Consent-gated pHash analysis for brand spoofing. |
| 7 | Email and browser integration | Gmail first, generic hover scanner, Outlook later. |
| 8 | Awareness and micro-training | Local training moment after a blocked threat. |
| 9 | UI and verdict display | Popup, options, detail panel, badges, onboarding. |
| 10 | Privacy audit and transparency | Audit log and one-click verifier. |
| 11 | Testing, performance, and QA | Unit, parity, E2E, privacy, performance, smoke checks. |
| 12 | Demo, pitch, and documentation | Pitch assets, demo script, fallback video, public docs. |

See the full [ticket list](ticket-list.md).

## Priority Definitions

- `P0`: Required for a credible working demo or privacy claim.
- `P1`: Strongly improves product quality or demo strength.
- `P2`: Stretch, polish, or production-hardening.

## Estimate Rules

Estimates assume a hackathon-style team with developers working in parallel. For production work, multiply estimates by at least 2 to account for review, hardening, accessibility, browser-store requirements, and documentation.

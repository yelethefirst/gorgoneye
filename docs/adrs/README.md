# Architecture Decision Records

ADRs document decisions that shape the implementation. They are intentionally concise but complete enough for a new developer to understand why the project is built this way.

## Status Values

- `Proposed`: under discussion.
- `Accepted`: the implementation should follow this decision.
- `Superseded`: replaced by a later ADR.

## ADR Index

| ADR | Status | Decision |
| --- | --- | --- |
| [0001](0001-local-first-browser-extension.md) | Accepted | Build Aegis Gorgon as a local-first browser extension. |
| [0002](0002-wxt-manifest-v3-typescript.md) | Accepted | Use WXT, Manifest V3, TypeScript, React, and Tailwind. |
| [0003](0003-background-orchestrated-detection.md) | Accepted | Put detection orchestration in the background runtime, not content scripts. |
| [0004](0004-layered-detection-and-fusion.md) | Accepted | Use independent detection layers with transparent weighted fusion. |
| [0005](0005-local-onnx-ml-classifier.md) | Accepted | Train ML offline and run ONNX inference locally in a worker. |
| [0006](0006-safe-browsing-hash-prefix-threat-intel.md) | Accepted | Use Safe Browsing hash-prefix flow, not full-URL lookup. |
| [0007](0007-local-llm-explanations.md) | Accepted | Use local LLM explanations as optional post-verdict enhancement with template fallback. |
| [0008](0008-consent-gated-visual-inspection.md) | Accepted | Treat visual brand analysis as consent-gated because remote rendering can disclose the target URL to the target origin. |
| [0009](0009-telemetry-audit-and-open-source-posture.md) | Accepted | Keep telemetry opt-in, audit all network calls, and prepare for open-source release. |
| [0010](0010-storage-cache-and-retention.md) | Accepted | Store settings and analysis artifacts locally with explicit retention. |
| [0011](0011-testing-performance-and-quality-gates.md) | Accepted | Enforce unit, parity, E2E, privacy, and performance gates. |
| [0012](0012-gmail-first-email-integration.md) | Accepted | Implement Gmail first, Outlook second, and keep generic hover scanning as fallback. |
| [0013](0013-visual-inspection-consent-flow.md) | Accepted | Per-URL, modal, default-decline consent flow for visual brand inspection. |

## ADR Template

Use this format for new decisions:

```md
# ADR-XXXX: Title

## Status

Proposed

## Context

What problem forces a decision?

## Decision

What decision are we making?

## Consequences

What improves? What gets harder? What must future implementers remember?

## Alternatives Considered

What else did we consider and why did we reject it?
```

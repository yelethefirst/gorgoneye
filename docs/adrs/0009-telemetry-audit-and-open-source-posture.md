# ADR-0009: Telemetry, Audit, And Open-Source Posture

## Status

Accepted

## Context

Security tools need trust. Aegis Gorgon makes strong privacy claims, so users and reviewers must be able to inspect behavior rather than rely on marketing language. Telemetry can help improve the product, but it is risky if it collects sensitive URLs or email-derived data.

## Decision

Telemetry defaults off. Network auditing is always local and enabled. The detection pipeline should be prepared for open-source release.

Implementation requirements:

- All outbound extension calls use an audited network wrapper.
- Audit logs remain local and expire after 24 hours by default.
- Telemetry requires explicit opt-in.
- Telemetry schema must exclude URLs, email content, screenshots, prompts, feature vectors, sender, and recipient.
- README and docs must describe the privacy architecture.
- Recommended open-source license is Apache 2.0 for patent clarity, with MIT acceptable for a hackathon.

## Consequences

Benefits:

- Stronger user trust.
- Stronger hackathon privacy proof.
- Easier third-party review.
- Lower regulatory and reputational risk.

Costs:

- Less product analytics by default.
- More implementation work around audit logging and payload scrubbing.
- Open-source posture requires careful key, dataset, and model-artifact hygiene.

## Alternatives Considered

Default-on telemetry:

- Better analytics, but rejected as inconsistent with privacy-first positioning.

No telemetry ever:

- Strongest privacy story, but enterprise deployments may need opt-in aggregate operational metrics.

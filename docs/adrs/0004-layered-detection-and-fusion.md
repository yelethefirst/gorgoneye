# ADR-0004: Layered Detection And Transparent Fusion

## Status

Accepted

## Context

No single phishing-detection technique is sufficient. Rules are interpretable but incomplete. ML catches combinations of signals but can be opaque. Threat intelligence catches known bad URLs but misses novel attacks. Visual similarity catches brand impersonation but has privacy and performance cost.

The product also needs to explain verdicts. A monolithic black-box score would weaken trust.

## Decision

Use independent detection layers with a fusion engine:

- Rules.
- Local ML.
- Threat intelligence.
- Optional header signals.
- Optional visual impersonation.
- Optional explanation as post-verdict reasoning, not as a blocking detector.

Each layer returns a typed result with status, score, evidence, timing, and errors. The fusion engine combines available evidence into `safe`, `suspicious`, `phishing`, or `unknown`.

## Consequences

Benefits:

- Defense in depth.
- Better explainability.
- Graceful degradation when optional layers fail.
- Easier testing of each layer.

Costs:

- Requires calibration to avoid false positives.
- More complex UI because layer status must be shown clearly.
- Fusion weights must be versioned and tested.

## Alternatives Considered

Rules only:

- Fast and explainable, but too easy to evade.

ML only:

- Compact interface, but poor transparency and harder privacy proof.

Threat-intelligence only:

- Useful for known attacks, weak against novel or newly staged phishing.

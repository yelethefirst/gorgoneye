# ADR-0006: Safe Browsing Hash-Prefix Threat Intelligence

## Status

Accepted

## Context

Threat intelligence is valuable because many phishing URLs are known globally before a specific user encounters them. However, sending full URLs to a lookup API would weaken the privacy promise.

## Decision

Use a Safe Browsing hash-prefix approach for threat-intelligence checks. The implementation must not use full-URL lookup mode.

The extension will:

- Canonicalize URLs locally.
- Hash locally.
- Compare local hash-prefix data where available.
- Send only hash prefixes when requesting matching full hashes.
- Perform final hash matching locally.
- Record every network call in the audit log.

## Consequences

Benefits:

- Adds high-quality external intelligence.
- Preserves a strong privacy posture.
- Creates a strong demo proof in the network tab and audit panel.

Costs:

- More complex than full URL lookup.
- Requires careful canonicalization.
- Requires local database management and update cadence.
- Still discloses a hash prefix, so docs must avoid claiming "absolutely nothing leaves device" when threat intelligence is enabled.

## Alternatives Considered

Full URL lookup:

- Easier, but rejected because it sends sensitive URLs.

No threat intelligence:

- Stronger privacy story, but weaker detection and less credible security posture.

Self-hosted threat feed:

- Possible later, but still requires trust and operations work.

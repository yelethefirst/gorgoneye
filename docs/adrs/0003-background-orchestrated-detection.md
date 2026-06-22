# ADR-0003: Background-Orchestrated Detection

## Status

Accepted

## Context

The original guide described some Layer 1 work as content-script based. Content scripts are the right place to observe webmail DOM changes and render badges, but they are not the right owner for the full detection pipeline.

Detection needs shared cache, workers, threat-intelligence lookups, audit logging, and settings. Those concerns are easier to secure and test in a central orchestrator.

## Decision

Content scripts will be thin. They will:

- Detect relevant links.
- Send typed analysis requests.
- Render badges, warnings, and tooltips.
- Avoid collecting email body text.

The background service worker will orchestrate detection. It will:

- Normalize URLs.
- Check cache.
- Run rules.
- Dispatch ML worker inference.
- Dispatch hash-prefix threat-intelligence lookup.
- Apply fusion.
- Record audit events.
- Return typed verdicts.

## Consequences

Benefits:

- Clear privacy boundary.
- Centralized network auditing.
- Easier unit and integration testing.
- Less duplicated logic across Gmail, Outlook, and generic scanners.
- Better resilience when adding more detection layers.

Costs:

- Requires robust message contracts.
- Must handle service-worker suspension and request timeouts.
- Requires careful request ID tracking for concurrent link scans.

## Alternatives Considered

Run all rules in content scripts:

- Faster for simple hover checks, but duplicates logic and makes auditing harder.

Run everything in popup:

- Popup is not always open and cannot own background protection.

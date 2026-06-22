# ADR-0012: Gmail-First Email Integration

## Status

Accepted

## Context

The product needs a credible email demo and real user value. Supporting every webmail client at once would spread effort thin. Gmail is the best first target for the hackathon because it is common, easy for judges to recognize, and sufficient to demonstrate inline protection.

## Decision

Implement email integration in this order:

1. Gmail open-email link extraction and inline badges.
2. Generic web hover scanner.
3. Outlook Web integration.
4. Header-authentication visibility if reliable UI hooks are available.

Gmail and Outlook content scripts must share the same background analysis API and UI primitives.

## Consequences

Benefits:

- Focused demo path.
- Lower selector and fixture burden early.
- Generic scanner still provides broad value outside webmail.

Costs:

- Outlook users wait until after Gmail path is stable.
- Gmail DOM changes remain a maintenance risk.
- Header analysis may be limited because webmail UIs do not always expose raw headers cleanly.

## Alternatives Considered

Build Gmail and Outlook simultaneously:

- Better coverage, but higher integration risk.

Generic scanner only:

- Easier, but weaker phishing-at-the-point-of-email story.

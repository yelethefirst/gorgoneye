# ADR-0008: Consent-Gated Visual Inspection

## Status

Accepted

## Context

Visual brand impersonation detection is powerful: a phishing page may look exactly like a Microsoft, Google, PayPal, or bank login page even if the URL is only moderately suspicious. The original guide proposed rendering the target page in an offscreen sandbox and comparing a perceptual hash.

The technical issue is privacy. Rendering a remote page requires a request to the target origin. Even if no data goes to Aegis servers, the target host can see a request from the user's network. For unopened email links, automatic rendering contradicts the strongest version of the privacy promise.

## Decision

Visual inspection is optional and consent-gated.

It may run only when:

- The user explicitly clicks "Inspect in sandbox".
- The user is already on the target page and asks for analysis.
- A local demo fixture is used.
- An enterprise-managed policy explicitly enables the behavior with notice.

The visual inspector must:

- Use an offscreen document.
- Avoid executing remote scripts.
- Use strict CSP.
- Compute screenshots and perceptual hashes locally.
- Never upload screenshots.
- Record whether a target-origin request occurred.

## Consequences

Benefits:

- Preserves honesty of privacy claims.
- Keeps a strong optional detector for high-risk cases.
- Makes the demo technically credible because the tradeoff is explicit.

Costs:

- Fewer automatic detections by default.
- More UI work because consent must be explained clearly.
- Slightly weaker "instant full pipeline" story unless demo uses consent or fixtures.

## Alternatives Considered

Automatic rendering of all suspicious links:

- Stronger detection, but rejected because target-origin requests can disclose user interest in a URL.

Remove visual inspection entirely:

- Simpler, but loses an important brand-impersonation signal.

Server-side screenshot service:

- Rejected because it sends URLs to a service and creates major trust and legal concerns.

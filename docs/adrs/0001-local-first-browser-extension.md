# ADR-0001: Local-First Browser Extension

## Status

Accepted

## Context

Aegis Gorgon is a phishing-defense product whose strongest differentiator is privacy. Cloud-based phishing checkers can explain suspicious content, but they require users to transmit sensitive email text. Server-side mail gateways can protect organizations, but they are expensive, operationally heavy, and unavailable to many individual users.

The product needs to intervene at the moment a user is about to click a suspicious link, especially inside webmail. That points toward the browser, because the browser sees the email UI and the click target without requiring mailbox-server integration.

## Decision

Build Aegis Gorgon as a local-first desktop browser extension.

The extension will:

- Run primary detection locally.
- Integrate directly with Gmail first and Outlook later.
- Provide generic hover-based scanning on normal web pages.
- Avoid sending email content to any service.
- Use privacy-preserving external calls only when needed and audited.

## Consequences

Benefits:

- Protects users at the point of attack.
- Works for individuals and small teams without mail-server integration.
- Supports a strong privacy story.
- Can demonstrate behavior directly in Gmail during a hackathon.

Costs:

- Browser-extension APIs impose Manifest V3 constraints.
- Webmail DOM integrations are brittle and require fixture tests.
- Mobile support is limited.
- Long-running tasks need careful handling because service workers can be suspended.

## Alternatives Considered

Server-side mail gateway:

- Strong enterprise fit, but too heavy for individual users and hackathon delivery.

Cloud phishing-analysis web app:

- Easier to build, but conflicts with the privacy promise and does not protect at click time.

Native desktop app:

- More system-level control, but harder to deploy and less directly integrated with webmail.

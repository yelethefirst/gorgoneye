# ADR-0002: WXT, Manifest V3, TypeScript, React, And Tailwind

## Status

Accepted

## Context

The implementation needs a fast extension development workflow, typed shared contracts, browser compatibility, and a UI stack suitable for a polished popup and options page. Plain Manifest V3 setup is possible but creates boilerplate and slows early delivery.

## Decision

Use:

- WXT for extension scaffolding and builds.
- Manifest V3 as the extension platform.
- TypeScript for all extension code.
- React for popup, options, onboarding, and detail panels.
- Tailwind CSS for styling.
- pnpm for package management.

## Consequences

Benefits:

- Faster scaffold and development loop.
- Typed entrypoints and shared modules.
- Easier Chrome, Edge, and Firefox build targeting.
- Good fit for React-based UI surfaces.

Costs:

- Developers must understand WXT conventions.
- Extension-store constraints still apply; WXT does not remove Manifest V3 limitations.
- Tailwind must be configured carefully to avoid style collisions in injected UI.

## Alternatives Considered

Plain Manifest V3:

- Less dependency surface, but more boilerplate and slower delivery.

Plasmo:

- Viable alternative, but WXT is a leaner fit for this implementation plan.

Vanilla UI:

- Smaller bundle, but slower to build polished popup/options flows.

# ADR-0007: Local LLM Explanations

## Status

Accepted

## Context

Users need clear explanations, not just risk scores. A cloud LLM would make explanation generation straightforward but would require sending sensitive context. A local LLM can preserve the privacy model, but it adds storage, hardware, and latency concerns.

## Decision

Use deterministic templates as the default explanation engine and support an optional local LLM via WebLLM as a post-verdict enhancement.

The LLM:

- Is lazy loaded only when requested.
- Runs locally.
- Receives structured detection signals only.
- Never receives raw email body, sender, recipient, or raw headers.
- Streams output when supported.
- Falls back to templates if unavailable.

## Consequences

Benefits:

- Keeps explanation private.
- Gives a compelling demo on capable hardware.
- Avoids blocking the initial verdict.
- Template fallback keeps the product usable everywhere.

Costs:

- Large model download.
- WebGPU availability varies.
- Browser extension policy review may require care around downloaded model assets.
- Prompt and output must be constrained to avoid invented evidence.

## Alternatives Considered

Cloud LLM:

- Better quality and easier runtime, but rejected for privacy.

Templates only:

- Reliable and small, but less compelling and less adaptive.

No explanations:

- Rejected because explainability is core to trust and training.

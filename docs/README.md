# Documentation

This folder is the implementation source of truth for Aegis Gorgon. It turns the original DOCX implementation guide into a structured engineering package: product scope, architecture, ADRs, implementation guides, epics, QA, demo material, and references.

## Reading Order

1. [Product vision and scope](product/vision-and-scope.md)
2. [Architecture overview](architecture/overview.md)
3. [Detection pipeline](architecture/detection-pipeline.md)
4. [Privacy and threat model](architecture/privacy-and-threat-model.md)
5. [ADR index](adrs/README.md)
6. [Implementation guide](guides/implementation-guide.md)
7. [Epic and ticket list](epics/ticket-list.md)
8. [Testing and QA guide](guides/testing-and-qa.md)
9. [End-to-end testing guide](guides/e2e-testing.md)
10. [Privacy verification guide](guides/privacy-verification.md)
11. [Demo playbook](guides/demo-playbook.md)
12. [Judge Q&A prep](guides/judge-qa.md)
13. [Cross-browser smoke checklist](guides/cross-browser-smoke.md)
14. [Release and distribution guide](guides/release-and-distribution.md)

## Document Groups

| Area | Documents | Purpose |
| --- | --- | --- |
| Product | [Vision and scope](product/vision-and-scope.md) | Defines users, value proposition, goals, non-goals, success metrics, and release scope. |
| Architecture | [Overview](architecture/overview.md), [Detection pipeline](architecture/detection-pipeline.md), [Privacy and threat model](architecture/privacy-and-threat-model.md), [Data contracts](architecture/data-contracts.md) | Defines the system boundaries, module responsibilities, data flow, privacy guarantees, and shared interfaces. |
| ADRs | [ADR index](adrs/README.md) | Records architectural decisions and the reasoning behind them. |
| Guides | [Development setup](guides/development-setup.md), [Implementation guide](guides/implementation-guide.md), [ML training](guides/ml-training-and-model-release.md), [Testing and QA](guides/testing-and-qa.md), [End-to-end testing](guides/e2e-testing.md), [Privacy verification](guides/privacy-verification.md), [Demo playbook](guides/demo-playbook.md), [Judge Q&A prep](guides/judge-qa.md), [Cross-browser smoke](guides/cross-browser-smoke.md), [Release and distribution](guides/release-and-distribution.md) | Gives developers step-by-step implementation, testing, demo, release, and distribution instructions. |
| Presentation | [Landing page](../landing/README.md) | The "front matter" of the project — what judges, reviewers, and prospective contributors see before they touch the code. (The presenter's own pitch-deck outline and video script live in the gitignored `personal-docs/` folder at the repo root.) |
| Delivery | [Epic overview](epics/README.md), [Ticket list](epics/ticket-list.md), [Changelog](../CHANGELOG.md), [Store listing](../STORE_LISTING.md), [Release workflow](../.github/workflows/release.yml) | Converts the plan into implementation-ready work items and packages them for store distribution. |
| Reference | [Datasets and APIs](reference/datasets-apis-and-resources.md), [Risk register](reference/risk-register.md) | Lists external inputs, technical resources, known risks, mitigations, and decision checkpoints. |

## Documentation Standards

- Keep privacy claims precise. If a feature can disclose data to a third party, document that explicitly.
- Keep ADRs immutable after acceptance. If a decision changes, add a new ADR that supersedes the old one.
- Every ticket should have acceptance criteria that can be tested or demonstrated.
- Every detection module should document inputs, outputs, failure behavior, and privacy behavior.
- Diagrams should use Mermaid where possible so they render directly in GitHub.
- Avoid linking implementation tickets to live phishing URLs. Use sanitized fixtures or vendor-provided test URLs.

## Definition Of Done For Docs

A documentation change is complete when:

- Links resolve.
- Any command examples are copy-pasteable once the scaffold exists.
- Privacy-sensitive behavior is described from the user's point of view.
- Architecture docs and ADRs agree with each other.
- Ticket acceptance criteria match the implementation guide.

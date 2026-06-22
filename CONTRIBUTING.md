# Contributing to Gorgon Eye

Thanks for thinking about contributing. Aegis is a privacy-preserving phishing-defense browser extension. Anything you submit needs to keep the privacy promises intact: email content stays local, full scanned URLs are never sent to Aegis-controlled services, and any new outbound network call goes through the audited fetch wrapper.

This document is the short-form guide. The long-form is in [`docs/`](docs/).

## Setup

Prerequisites: Node 20+, pnpm 10+, Chrome stable.

```bash
pnpm install        # also runs `wxt prepare`
pnpm dev            # WXT dev server; loads .output/chrome-mv3/
pnpm typecheck
pnpm lint
pnpm test           # full Vitest suite
pnpm test:coverage  # same, with v8 coverage + enforced thresholds (≥80% per detection module)
pnpm build          # production build
```

The coverage gate fails when any of `src/rules/**`, `src/detection/**`, `src/threat-intel/**`, `src/audit/**`, `src/privacy/**`, or `src/explanations/**` drops below 80% lines / functions / statements. If you add a file under those trees, add tests for it in the same PR.

Then open `chrome://extensions`, enable Developer Mode, "Load unpacked", and pick `.output/chrome-mv3/`.

See [`docs/guides/development-setup.md`](docs/guides/development-setup.md) for more detail.

## Repository layout

| Path | Purpose |
| --- | --- |
| `entrypoints/` | Extension entrypoints (background, popup, options, welcome, content scripts). |
| `src/shared/` | Cross-layer types (`verdict.ts`, `messages.ts`, `audit.ts`, `parsedUrl.ts`). |
| `src/rules/` | Layer 1 — rules engine, individual rules under `src/rules/rules/`. |
| `src/detection/` | Orchestration: `analyzeUrl.ts`, `fusion.ts`, `perf.ts`. |
| `src/threat-intel/` | Layer 3 — Safe Browsing hash-prefix client. |
| `src/audit/` | Centralized audited fetch wrapper + audit store. |
| `src/privacy/` | One-click privacy verifier (`verifier.ts`). |
| `src/explanations/` | Template explanation engine. |
| `src/storage/` | KV store, settings, verdict cache, prefix DB. |
| `src/ui/` | React components + design system + content-script DOM helpers. |
| `src/fixtures/` | Curated demo URLs (`demoFixtures.ts`). |
| `tests/` | Vitest specs mirroring `src/` structure. |
| `docs/` | Architecture, ADRs, guides, epics. |

## Test conventions

- Pure logic lives next to its callers and is unit-tested directly. UI panels also have render-smoke tests via `react-dom/server`.
- DOM-touching tests use `// @vitest-environment happy-dom` at the top of the spec file.
- Every new rule needs:
  - A weight entry in [`src/rules/weights.ts`](src/rules/weights.ts).
  - A `Rule` export in `src/rules/rules/<name>.ts`.
  - Registration in [`src/rules/defaultRules.ts`](src/rules/defaultRules.ts).
  - A dedicated test file under `tests/rules/`.
  - A line in the demo-fixtures perf test if it changes verdict buckets.

## Adding a new outbound network call

Every outbound network call MUST go through [`src/audit/auditedFetch.ts`](src/audit/auditedFetch.ts). The wrapper enforces:

- No email content (structural: there is no field for it).
- No full scanned URLs in the body unless the call is a consented `target_origin_request`.
- Record of destination, purpose, byte counts, and status in the audit log.
- A `testMode` shortcut so the privacy verifier can exercise the call shape offline.

If you find yourself reaching for `fetch()` directly, stop and route through `auditedFetch` instead.

## Privacy review checklist for PRs

Before requesting review on a PR that adds or changes a feature that touches networking, storage, or content scripts, confirm each of these:

- [ ] Does this PR introduce any field, log, or storage record that could carry email body text, sender, or recipient? If yes, remove it.
- [ ] Does any outbound call carry the full scanned URL? If so, is it gated on user consent AND categorized as `target_origin_request`?
- [ ] If you added a settings flag, is the most privacy-preserving value the default?
- [ ] If you added a content-script reader, does it read only what is strictly required for the feature (e.g. `href`, not surrounding text)?
- [ ] If you added a new audited call, does the privacy verifier still pass (`pnpm test tests/privacy/verifier.test.ts`)?
- [ ] If you bumped weights or added a rule, do the perf budgets still hold (`pnpm test tests/detection/perfBudget.test.ts`)?

## Style and tooling

- ESLint flat config + Prettier. `pnpm lint --fix` and `pnpm format` keep things tidy.
- TypeScript strict mode, `noUncheckedIndexedAccess`, `noImplicitOverride`.
- React 19 + Tailwind v4 (CSS-driven, `@theme` tokens). Reuse design-system primitives from [`src/ui/components/`](src/ui/components/).
- Default to relative imports inside `src/` and from `entrypoints/`. The repo doesn't ship a path-alias config.

## Commit and PR conventions

- One logical change per commit.
- Commit messages: imperative, scoped (`rules: add idn-confusable rule`, `popup: surface explanation text`).
- PR description should call out the privacy impact, the tests you added, and any new entry in the audit-log schema.

## Data and secrets

- `.env.local` is gitignored and never gets committed.
- Training datasets and raw phishing corpora (when Epic 3 ML lands) must be excluded by `.gitignore` and treated as licensed inputs.
- Live phishing URLs are NOT acceptable as test fixtures. Use synthetic hostnames (e.g. `paypa1.example`) or reserved TLDs.

## Reporting security issues

Please don't open public issues for vulnerabilities. Until a dedicated security contact is set up, email the maintainers directly and we'll coordinate disclosure.

## License

By contributing, you agree your contributions are licensed under the [Apache 2.0 License](LICENSE) and that you have the right to license them under that license (per the standard Apache CLA-style submission terms in section 5 of the license).

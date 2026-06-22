# End-to-End Testing Guide

Playwright is the runner. There is exactly **one** spec today —
[`tests/e2e/badges.spec.ts`](../../tests/e2e/badges.spec.ts) — and that is
deliberate. This guide explains the setup, the run loop, how to add more
specs, and how to debug failures.

## What E2E is for in this repo

The Vitest unit + happy-dom suites already cover ~95% of behaviour
(parser, rules, fusion, audit, storage, UI components, content-script
DOM logic against a simulated document). Playwright is reserved for the
small set of things only a **loaded extension in a real browser** can
verify:

- The extension actually loads from `.output/chrome-mv3/`.
- `chrome.runtime.onInstalled` opens the welcome page on a fresh profile.
- A content script attaches to a real page and renders verdict badges.
- Clicking a badge opens its popover and renders the URL + fired signals.

If a behaviour can be verified with happy-dom (most things), prefer Vitest.
Reserve E2E for things that exercise the Manifest V3 boundary — the
service worker, content-script injection, `chrome.*` APIs.

## Stack

| Piece | Source |
| --- | --- |
| Runner | [`playwright.config.ts`](../../playwright.config.ts) |
| Spec(s) | [`tests/e2e/`](../../tests/e2e/) |
| Fixture page | [`tests/fixtures/gmail-message.html`](../../tests/fixtures/gmail-message.html) |
| Built extension | `.output/chrome-mv3/` (produced by `pnpm build`) |
| Result traces | `tests/e2e/.results/` (gitignored) |

Browser: **Chromium only, headed**. Manifest V3 extensions require a real
GPU/UI context — they don't load in `--headless=new` reliably enough for
CI. The config sets `headless: false` and `workers: 1` because every spec
shares the same persistent Chromium context.

## Build precondition

Playwright does **not** run `pnpm build` for you. This is intentional —
when you're iterating on a spec you don't want to pay the 2-second build
cost on every run. The trade-off: if you change a content script or the
manifest and forget to rebuild, the test runs against stale extension
code. The error you'll see is usually a silent "no badge appeared" timeout.

Fresh build whenever the extension code changes:

```bash
pnpm build && pnpm test:e2e
```

CI does both in sequence; the failure mode is only relevant during local
iteration.

## Run the suite

```bash
pnpm test:e2e                  # all specs, headed Chromium
pnpm test:e2e --headed=false   # try anyway; will fail under MV3
pnpm test:e2e --debug          # opens Playwright Inspector, step through
pnpm test:e2e -- --ui          # interactive UI mode
pnpm test:e2e -g "phishing"    # filter by test title
```

Output:

- Pass: a one-line summary per test.
- Fail: a `tests/e2e/.results/<test-name>/` directory with
  `trace.zip`, screenshots, and video.

Inspect a trace:

```bash
pnpm exec playwright show-trace tests/e2e/.results/*/trace.zip
```

This opens the Playwright Trace Viewer in your browser — DOM snapshots
per step, network log, console log, action timeline. It is the fastest
way to see why a step failed.

## What the existing spec covers

[`tests/e2e/badges.spec.ts`](../../tests/e2e/badges.spec.ts) has three
tests against the same persistent context:

1. **Extension loads** — waits for `chrome.runtime.onInstalled` to open
   `welcome.html`. Fails fast if the extension itself didn't load.
2. **Hover scanner badges links** — opens
   `http://127.0.0.1:4173/gmail-message.html`, hovers a phishing link
   (`paypa1.example`), a suspicious link (`/r?to=…`), and a safe link
   (`github.com`), then asserts exactly 2 badges appear with the
   expected verdict text.
3. **Badge popover** — clicks the phishing badge, asserts the popover
   shows the URL and at least one of the expected signal names
   (typosquatting / credential), then closes it.

The fixture server is started by Playwright's `webServer` block in the
config — `pnpm exec http-server tests/fixtures -p 4173`. Chrome content
scripts don't run on `file://`, so the page has to be served over
http(s).

## Adding a new spec

Before writing one, ask: **can this be a happy-dom Vitest test instead?**
If you're testing DOM logic, the answer is usually yes. Examples of
things that genuinely need E2E:

- A new `chrome.*` API call (storage, action, runtime messaging across
  pages).
- A new content script `matches:` pattern.
- The popup's `chrome.runtime.sendMessage` round-trip to the background.
- The Manifest V3 service worker lifecycle (revival from suspension).

Spec skeleton:

```ts
import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" }); // share the persistent context

test("my new behaviour", async ({ page }) => {
  await page.goto("/gmail-message.html"); // baseURL is :4173
  // …
});
```

Use the existing spec's `beforeAll` pattern to launch the persistent
Chromium context with `--load-extension`. Don't try to do it per-test —
the launch cost is multi-second and the welcome page only opens once.

## Common failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| `chromium.launchPersistentContext` hangs | Stale Chromium from a prior crashed run | `pkill -f chromium; rm -rf ~/.cache/ms-playwright/*tmp*` |
| "No badge appeared" timeout | Extension code changed, no rebuild | `pnpm build && pnpm test:e2e` |
| "Welcome page didn't open" | Test running on a profile that already saw `onInstalled` | The persistent context uses a fresh tmp profile per launch; if you see this repeatably, check `chrome.runtime.onInstalled` in `entrypoints/background.ts` |
| Fixture page returns 404 | `webServer` didn't start; port 4173 occupied | `lsof -ti:4173 \| xargs kill; pnpm test:e2e` |
| Spec passes locally, fails in CI | Headed-only and CI doesn't have a display | Run under `xvfb-run -a pnpm test:e2e` |

## When to update this guide

- A new spec is added and exercises a surface this guide doesn't list.
- The build output path changes (anything other than
  `.output/chrome-mv3/`).
- The fixture server port or path changes.
- Playwright config gains a new project (e.g. Firefox or WebKit) — note
  that MV3 extension loading is Chromium-specific; Firefox would need a
  different launch path.

## Related

- Unit/integration tests — [`testing-and-qa.md`](testing-and-qa.md).
- Manual cross-browser pass on top of the automated E2E —
  [`cross-browser-smoke.md`](cross-browser-smoke.md).
- The ticket that produced this spec —
  [`AEG-11-2`](../epics/ticket-list.md) in the epic ticket list.

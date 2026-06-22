# Release and Distribution Guide

End-to-end procedure for cutting a release: bump version → produce signed
store artifacts → submit to Chrome Web Store / Firefox Add-ons / Edge
Add-ons → deploy the landing page → tag the GitHub release.

This guide is **not** the day-to-day install flow. For loading the
extension into a developer's own Chrome (no signing, no store), see
[`development-setup.md`](development-setup.md). For the manual
cross-browser smoke pass on each candidate artifact, see
[`cross-browser-smoke.md`](cross-browser-smoke.md). This document picks
up where those end: producing a real distributable.

## Companion files

A tag push to `v*` triggers
[`.github/workflows/release.yml`](../../.github/workflows/release.yml).
That workflow:

- re-runs lint + typecheck + coverage,
- verifies the tag matches `package.json` version,
- builds Chrome MV3 + Firefox MV2,
- packages both zips,
- pulls release notes from the matching section of
  [`../../CHANGELOG.md`](../../CHANGELOG.md), and
- drafts a GitHub Release with both zips attached.

The reviewer copy you'll paste into each store's submission form lives
at [`../../STORE_LISTING.md`](../../STORE_LISTING.md) — keep that file
in sync with `wxt.config.ts` so the manifest and the reviewer-facing
justification can't drift apart.

## Pre-flight

Before you do anything below, the candidate commit must:

- pass `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage` (≥ 80% per
  detection folder)
- pass `pnpm test:e2e` against a fresh `pnpm build` (see
  [`e2e-testing.md`](e2e-testing.md))
- pass the in-product **Run verification** privacy check at least once
  on the built extension (load `.output/chrome-mv3/`, open Options →
  Run verification → all green)
- pass the full manual sweep in [`cross-browser-smoke.md`](cross-browser-smoke.md)
  on Chrome stable + Firefox MV2 + Edge

Treat any failure as a release-blocker. The privacy verifier is the load-
bearing one — it is the only step that exercises the auditedFetch
guarantee inside a real loaded extension.

## 1. Bump the version

Two files must agree. WXT reads the version from
[`package.json`](../../package.json) and writes it into the produced
`manifest.json`, so the single source of truth is `package.json`.

```bash
# Pick semver bump: patch / minor / major. Avoid `npm version` (touches git).
# Manually edit package.json's "version" field instead, then:
pnpm install --lockfile-only
```

Verify:

```bash
pnpm build
jq .version .output/chrome-mv3/manifest.json    # should match package.json
```

The store reviewers reject updates whose `manifest.json` version is not
strictly greater than the previously approved one. Use semver:

- **patch** (`0.0.1` → `0.0.2`) — bug fixes, no new permissions, no UI
  copy changes.
- **minor** (`0.0.1` → `0.1.0`) — new detection layers, new UI surfaces,
  new opt-in toggles. No removal of guarantees.
- **major** (`0.0.1` → `1.0.0`) — change to a permission, change to a
  privacy claim, removal of a feature.

## 2. Produce the artifacts

```bash
pnpm install --frozen-lockfile     # reproducible
pnpm build                         # Chrome MV3 → .output/chrome-mv3/
pnpm build:firefox                 # Firefox MV2 → .output/firefox-mv2/
pnpm zip                           # → .output/aegis-gorgon-<version>-chrome.zip
```

`pnpm zip` produces the Chrome upload artifact today; the file is
`.output/aegis-gorgon-<version>-chrome.zip` (~11 MB at v0.0.1, dominated
by the onnxruntime-web WASM blobs at `.output/chrome-mv3/ort/`). For
Firefox, zip the build output directly:

```bash
( cd .output/firefox-mv2 && zip -r ../aegis-gorgon-<version>-firefox.zip . )
```

Both archives are unsigned at this point — signing happens at the store.

## 3. Chrome Web Store submission

The exact text for every store form field — short description, detailed
description, single-purpose statement, every permission justification,
the CSP justification, the privacy-practices answers — lives at
[`../../STORE_LISTING.md`](../../STORE_LISTING.md). Open that file in a
second tab; copy-paste from there into the dashboard. The paragraphs
below give the structural rationale; `STORE_LISTING.md` has the
ready-to-paste copy.

### What the reviewer checks

The Chrome team's MV3 review pays attention to four Aegis-specific things:

1. **Host permissions list.** Today: `https://mail.google.com/*`,
   `https://huggingface.co/*` (+ `*.huggingface.co/*`), `https://hf.co/*`
   (+ `*.hf.co/*`), `https://raw.githubusercontent.com/*`. The
   Hugging Face / hf.co / raw.githubusercontent.com entries are
   non-obvious — they exist solely to let `@mlc-ai/web-llm` download
   model artifacts when the user opts into the Local LLM toggle.
   Document this in the **Permission justification** field, verbatim:

   > Hugging Face / hf.co / raw.githubusercontent.com host permissions are
   > used exclusively to download the locally-running WebLLM model when
   > the user opts into the "Local LLM explanations" toggle (off by
   > default). No content from these origins is shown to the user; the
   > model file is cached in IndexedDB and used only on-device.

2. **Content-script `matches`.** The generic hover scanner injects on
   `http://*/*` + `https://*/*` with `exclude_matches:
   ["https://mail.google.com/*"]` (Gmail has its own dedicated content
   script). Justify in **Single purpose**:

   > Phishing-link verdicts at hover time. The content script only reads
   > the `href` attribute of anchor elements and overlays a verdict
   > badge; it never reads surrounding text, sibling elements, page
   > content, form values, or storage. All analysis happens on-device.

3. **`wasm-unsafe-eval` in the CSP** (`extension_pages: "script-src
   'self' 'wasm-unsafe-eval'; object-src 'self'"`). Required by
   `onnxruntime-web` to stream-compile its WASM module. Mention this in
   the privacy practices form:

   > `wasm-unsafe-eval` is enabled to allow the local ONNX phishing
   > classifier to compile its WebAssembly module at load time. This is
   > the standard, narrowest CSP grant for `onnxruntime-web` and is not
   > used for remote-code execution.

4. **Remote code claim.** Tick **No** for "uses remote code". The WebLLM
   model artifact is data, not code. The runtime is bundled.

### Required uploads

| Field | Source |
| --- | --- |
| Extension package | `.output/aegis-gorgon-<version>-chrome.zip` |
| Privacy policy URL | Link to the privacy section of the deployed landing page (`landing/index.html` → `#privacy`) |
| Single purpose | Use the Single-purpose paragraph above |
| Permission justification | Use the Host permissions paragraph above |
| Screenshots (1280×800, ≥ 1) | Take from the popup detail panel + transparency panel |
| Promotional images | Optional; use the hero block of `landing/index.html` |
| Test instructions for reviewer | "Open the bundled `tests/fixtures/gmail-message.html` via any static server (`npx serve tests/fixtures`), hover the `paypa1.example` link, a red Phishing badge appears with the URL and fired signals." |

### Privacy practices form

Answer truthfully against
[`docs/architecture/privacy-and-threat-model.md`](../architecture/privacy-and-threat-model.md):

- **Personally identifiable information:** No.
- **Health information:** No.
- **Financial / payment information:** No.
- **Authentication information:** No (we read `href`, not form values).
- **Personal communications:** No (we read URLs, not email bodies; the
  privacy verifier proves this structurally).
- **Location:** No.
- **Web history:** No (URL analysis is per-hover, results stored locally
  for the cache TTL, never transmitted).
- **User activity:** No.
- **Website content:** No (with one caveat — the consent-gated visual
  inspector fetches a single page's HTML *only* after explicit per-URL
  consent and only to compare logo pixels; this is logged in the audit
  log as `target_origin_request`. Disclose it explicitly).
- **Sells / shares data with third parties:** No.
- **Uses data for advertising:** No.
- **Uses data unrelated to single purpose:** No.

### Submission flow

1. https://chrome.google.com/webstore/devconsole/ → New item → upload
   the zip.
2. Fill the store listing (description, screenshots, category =
   "Productivity").
3. Fill the privacy practices form with the answers above.
4. Submit for review. First-time submission: typically 1–3 business
   days. Updates: hours to a day.

## 4. Firefox Add-ons (AMO) submission

Firefox needs the **MV2** build, not the Chrome MV3 zip. WXT produces
both.

### Key differences from Chrome

- AMO requires the artifact to be **signed by Mozilla** before users can
  install it from anywhere other than Firefox Developer Edition or
  Nightly. The store handles signing during review.
- `host_permissions` in MV2 is expressed differently in the manifest;
  WXT handles this automatically when you run `pnpm build:firefox`.
- AMO reviewers look at **source code**, not just the bundled artifact.
  Include a `SOURCE.md` or link to the public GitHub repo as the
  source-reference field at submission time.

### Submission flow

1. Zip the Firefox build:
   `( cd .output/firefox-mv2 && zip -r ../aegis-gorgon-<version>-firefox.zip . )`
2. https://addons.mozilla.org/developers/ → Submit a New Add-on → upload
   the Firefox zip.
3. Select **On this site** distribution (not self-hosted).
4. Source code field: link to the GitHub commit SHA matching this
   release.
5. Reviewer notes — reuse the Permission justification and Single
   purpose paragraphs from §3.

Reviewer follow-up is more thorough than Chrome's; expect questions
about the WASM CSP and the WebLLM host_permissions.

## 5. Edge Add-ons submission

Edge accepts the **same Chrome MV3 zip** as the Chrome Web Store. No
separate build.

1. https://partner.microsoft.com/dashboard/microsoftedge/ → Submit an
   extension → upload `.output/aegis-gorgon-<version>-chrome.zip`.
2. Reuse the Chrome listing copy verbatim.
3. Microsoft's review is normally faster than Chrome's (often < 24 h
   for updates).

## 6. Deploy the landing page

### Now automated

The landing page deploy is now triggered automatically by
[`.github/workflows/landing-deploy.yml`](../../.github/workflows/landing-deploy.yml)
on any push to `main` that touches `landing/**` (and is also runnable on
demand via the workflow's manual `workflow_dispatch` button in the
Actions tab). The workflow uploads `landing/` as-is to the `github-pages`
environment via `actions/upload-pages-artifact` +
`actions/deploy-pages`, so no orphan-branch bookkeeping is required for
the normal path.

The manual `gh-pages` branch flow and the Cloudflare Pages / Vercel /
Netlify paths below are preserved as fallbacks — useful if Pages is
disabled on the repo, if you need to deploy from a non-`main` branch, or
if you're standing up a mirror on a second host.

[`landing/index.html`](../../landing/index.html) is a single dependency-
free HTML file. Any static host works.

### GitHub Pages (simplest)

```bash
# From a clean checkout
git checkout --orphan gh-pages
git rm -rf .
cp ../aegis-gorgon/landing/index.html .
git add index.html
git commit -m "Deploy landing v<version>"
git push origin gh-pages
# Then in repo Settings → Pages → Branch: gh-pages → Save
```

### Cloudflare Pages / Vercel / Netlify

Point the project at the `landing/` directory; build command is empty,
output directory is `landing`. Zero config.

Before deploying, [`landing/README.md`](../../landing/README.md) lists
the in-page strings to update:

- GitHub URLs (currently `aegishield/aegis-gorgon` placeholder).
- Version badge.
- Anything mirrored from the demo playbook.

The Chrome Web Store privacy policy URL must point at a section of the
deployed landing page (or a separate page on the same host), so ship
the landing page **before** submitting to the store.

## 7. Tag the GitHub release

This step is automated. Before tagging:

1. In [`../../CHANGELOG.md`](../../CHANGELOG.md), rename the
   `[Unreleased]` heading to `[<version>] - YYYY-MM-DD` and add a fresh
   empty `[Unreleased]` block above it.
2. Commit the bump (`package.json` version + CHANGELOG rename) on
   `main`.

Then tag:

```bash
git tag -a v<version> -m "Release v<version>"
git push origin v<version>
```

The push fires
[`.github/workflows/release.yml`](../../.github/workflows/release.yml),
which:

- verifies the tag matches `package.json` version (a guard against
  forgetting one or the other),
- re-runs lint + typecheck + coverage,
- builds Chrome MV3 and Firefox MV2,
- packages both zips,
- extracts the `[<version>]` section of `CHANGELOG.md` as the release
  body (with a placeholder fallback if no entry exists),
- creates a **draft** GitHub Release with both zips attached.

Open the draft, sanity-check the notes, and click Publish. The draft
state is deliberate — a human reviews before the release becomes
public.

## 8. Post-release verification

After the stores publish, install from each store on a clean profile
and re-run the relevant beats from
[`cross-browser-smoke.md`](cross-browser-smoke.md). The
post-store-install run can catch things that local `Load unpacked`
misses — store-mediated permission prompts, auto-update behaviour, the
welcome page firing on the store-installed `chrome.runtime.onInstalled`.

If a regression slips through, **do not patch the store listing in
place** — bump the patch version (`pnpm version patch` if you've enabled
it, or edit `package.json` directly), produce fresh artifacts, and
resubmit. Every store install must trace back to a tagged release.

## Aegis-specific reviewer pitfalls

- **"Why do you need access to Hugging Face?"** Always asked. Answer:
  the user opts into the Local LLM explanation toggle (off by default);
  when on, WebLLM downloads the model file from huggingface.co or
  raw.githubusercontent.com to be cached in IndexedDB and run on-device.
  No data is sent back to those origins; no user content is shared.
- **"What is `wasm-unsafe-eval` doing?"** ONNX Runtime Web (the local
  phishing classifier) stream-compiles WASM at load. Standard pattern;
  see [ADR-0005](../adrs/0005-local-onnx-ml-classifier.md).
- **"You match on `http://*/*` and `https://*/*`."** Single-purpose
  justification: hover-based URL verdicts must reach every page the
  user might click a link from. We only read `href`, not page content.
  See [ADR-0001](../adrs/0001-local-first-browser-extension.md).
- **"What's `target_origin_request` in your audit log?"** The
  consent-gated visual inspector. Off by default; each invocation is
  consent-gated per-URL; both consent grants and declines are logged.
  See [ADR-0013](../adrs/0013-visual-inspection-consent-flow.md).

## Related

- [`development-setup.md`](development-setup.md) — local dev loop,
  `Load unpacked`.
- [`cross-browser-smoke.md`](cross-browser-smoke.md) — manual pass on
  each browser.
- [`e2e-testing.md`](e2e-testing.md) — Playwright runbook.
- [`privacy-verification.md`](privacy-verification.md) — what the
  in-product **Run verification** button actually checks.
- [`../../STORE_LISTING.md`](../../STORE_LISTING.md) — ready-to-paste
  copy for every store form field.
- [`../../CHANGELOG.md`](../../CHANGELOG.md) — release notes; the
  release workflow extracts the matching `[<version>]` section.
- [`../../.github/workflows/release.yml`](../../.github/workflows/release.yml)
  — the automation triggered on `v*` tag push.
- [`../../public/icon/README.md`](../../public/icon/README.md) — icon
  size + generation conventions (PNGs are not committed yet; hard
  blocker for store submission until they are).
- [`landing/README.md`](../../landing/README.md) — landing page edits
  before deploy.

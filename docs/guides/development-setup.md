# Development Setup

This guide defines the expected local development setup once the WXT extension scaffold is created. The current repository is documentation-first, so the first implementation ticket is to create the application files described here.

## Prerequisites

Install:

- Node.js 20 or newer.
- pnpm 9 or newer.
- Chrome or Chromium.
- Python 3.11 or newer for model-training work.
- Git once the project is moved into a Git repository.

Recommended browser setup:

- Chrome stable for extension development.
- Chrome Canary or Edge for cross-browser smoke checks.
- Firefox Developer Edition if Firefox support is in scope for the sprint.

## Initial Scaffold

From the repository root, the implementation team should initialize WXT with TypeScript:

```bash
pnpm create wxt@latest .
```

Recommended choices:

- Framework: React.
- Language: TypeScript.
- Package manager: pnpm.
- Extension target: Manifest V3.

After scaffold, install detection-stack dependencies as the relevant milestones arrive (`tldts` and `fast-levenshtein` for Milestone 1 rules, `idb` for Milestone 6 storage upgrades, `onnxruntime-web` for Milestone 3 ML):

```bash
pnpm add tldts fast-levenshtein idb onnxruntime-web
pnpm add -D vitest @vitest/coverage-v8 playwright eslint prettier typescript
```

The Milestone 0 scaffold installs only the framework, React, ESLint, Prettier, Vitest, and TypeScript. Detection-stack packages are added in later milestones to keep the scaffold lean and avoid build cost before they are used.

Optional dependencies for later phases:

```bash
pnpm add @mlc-ai/web-llm
```

## Expected Scripts

`package.json` should expose:

```json
{
  "scripts": {
    "dev": "wxt",
    "dev:firefox": "wxt -b firefox",
    "build": "wxt build",
    "build:firefox": "wxt build -b firefox",
    "zip": "wxt zip",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:privacy": "vitest run tests/privacy",
    "test:perf": "vitest run tests/perf"
  }
}
```

## Environment Variables

Create `.env.local` and never commit it:

```bash
VITE_SAFE_BROWSING_API_KEY=your_safe_browsing_api_key
VITE_ENABLE_SAFE_BROWSING=false
VITE_ENABLE_LLM=false
VITE_WEBLLM_MODEL_ID=SmolLM2-1.7B-Instruct-q4f32_1-MLC
VITE_ENABLE_VISUAL_INSPECTION=false
```

Rules:

- Default all optional external or heavy features off in local development.
- Keep real API keys out of tests.
- Use vendor-provided test endpoints or fixtures for privacy tests.

## Recommended Directory Layout

```text
entrypoints/
  background.ts
  gmail.content.ts
  outlook.content.ts
  generic.content.ts
  popup/
    App.tsx
    main.tsx
    index.html
  options/
    App.tsx
    main.tsx
    index.html
src/
  audit/
    auditedFetch.ts
    auditStore.ts
  detection/
    orchestrator.ts
    fusion.ts
    verdict.ts
  explanations/
    promptBuilder.ts
    templateExplanation.ts
  ml/
    features.ts
    worker.ts
    modelLoader.ts
  privacy/
    verifier.ts
    redaction.ts
  rules/
    parseUrl.ts
    rulesEngine.ts
    rules/
  storage/
    settings.ts
    verdictCache.ts
    indexedDb.ts
  threat-intel/
    safeBrowsing.ts
    hash.ts
    canonicalize.ts
  ui/
    components/
    badge/
    popup/
  visual/
    consent.ts
    offscreen.ts
    phash.ts
public/
  data/
    brand-domains.json
    brand-hashes.json
  models/
    phishing-classifier.onnx
tests/
  fixtures/
  e2e/
  privacy/
  perf/
training/
  build_dataset.py
  train.py
  export_onnx.py
  FEATURES.md
```

## Loading The Extension

During development:

```bash
pnpm dev
```

Then:

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Click "Load unpacked".
4. Select the generated `.output/chrome-mv3` directory.
5. Pin the extension.

For production-like build:

```bash
pnpm build
```

Load the generated build output rather than the dev output.

For producing a distributable artifact (signed via the store at upload
time) and submitting to the Chrome Web Store / Firefox Add-ons / Edge
Add-ons, follow [`release-and-distribution.md`](release-and-distribution.md).
That guide also covers the landing-page deploy and the GitHub Release
flow.

## Branch And Commit Hygiene

Once this becomes a Git repository:

- Keep docs, model artifacts, and app code changes separated when practical.
- Do not commit `.env.local`.
- Do not commit raw phishing datasets if licensing does not allow redistribution.
- Commit small deterministic fixtures for tests.
- Record architecture changes with ADRs.
- Update tickets when acceptance criteria change.

## Local Data Hygiene

Developers should be able to clear local state quickly:

- Extension options page should include "Clear local cache".
- During development, document IndexedDB database names.
- Tests should use isolated storage or reset storage between runs.

## First-Day Setup Checklist

- WXT scaffold builds.
- Popup opens.
- Background service worker logs a startup event.
- Content script injects into a local fixture page.
- Message bus sends `ANALYZE_URL` and receives a stub result.
- Vitest runs.
- ESLint and typecheck run.
- README quick-start commands are accurate.

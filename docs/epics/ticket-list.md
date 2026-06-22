# End-To-End Ticket List

Ticket IDs follow `AEG-<epic>-<ticket>`. Each ticket includes priority, estimate, dependencies, implementation notes, and acceptance criteria.

## Epic 1: Project Foundation And Extension Scaffold

Goal: create a working extension skeleton that all later work can build on.

### AEG-1-1: Initialize WXT Extension Project With TypeScript

Priority: P0  
Estimate: 1 hour  
Depends on: none

User story:

As a developer, I want a clean WXT-based extension scaffold so the team can build features in parallel.

Implementation notes:

- Use WXT, TypeScript, React, Tailwind, pnpm.
- Configure Manifest V3.
- Add background, popup, options, Gmail content, and generic content entrypoints.

Acceptance criteria:

- `pnpm dev` produces a loadable Chrome extension.
- Popup opens.
- Manifest includes required permissions: `storage`, `scripting`, `activeTab`, `tabs`, and later `offscreen`.
- ESLint, Prettier, and Vitest are configured.
- README quick-start instructions work.

### AEG-1-2: Configure Cross-Browser Build

Priority: P1  
Estimate: 1 hour  
Depends on: AEG-1-1

Acceptance criteria:

- Chrome build succeeds.
- Firefox build succeeds if Firefox support remains in scope.
- Build outputs are documented.
- Browser-specific limitations are listed.

### AEG-1-3: Set Up Typed Message Passing

Priority: P0  
Estimate: 2 hours  
Depends on: AEG-1-1

Implementation notes:

- Define message contracts in `src/shared/messages.ts`.
- Use discriminated unions.
- Include request IDs.

Acceptance criteria:

- Content script sends `ANALYZE_URL`.
- Background returns a stub `ANALYZE_URL_RESULT`.
- Popup can request cached verdicts.
- Tests cover successful response and typed error response.

### AEG-1-4: Implement Storage Layer

Priority: P0  
Estimate: 2 hours  
Depends on: AEG-1-1

Acceptance criteria:

- `chrome.storage.local` wrapper for settings.
- IndexedDB wrapper for verdict cache, audit log, model metadata, pHash DB, and training progress.
- Verdict cache supports TTL eviction.
- Unit tests cover get, set, delete, migration, and TTL cleanup.

### AEG-1-5: Create CI Pipeline

Priority: P2  
Estimate: 1 hour  
Depends on: AEG-1-1

Acceptance criteria:

- Workflow runs on push and pull request.
- Installs dependencies.
- Runs lint, typecheck, tests, and build.
- Uploads extension artifact.

## Epic 2: Layer 1 - Rule-Based URL Analysis Engine

Goal: fast deterministic URL analysis that returns interpretable signals in under 10 ms.

### AEG-2-1: URL Parsing And Normalization

Priority: P0  
Estimate: 2 hours  
Depends on: AEG-1-3

Acceptance criteria:

- `parseUrl()` returns the `ParsedUrl` contract from the data contracts doc.
- Uses `new URL()` and `tldts`.
- Handles malformed URLs, IDNs, punycode, IPv4, IPv6, `javascript:`, `data:`, and `file:`.
- Unit tests cover at least 20 URL variants.

### AEG-2-2: IP Hostname Rule

Priority: P0  
Estimate: 1 hour  
Depends on: AEG-2-1

Acceptance criteria:

- Detects IPv4 and IPv6 literal hostnames.
- Does not fire for normal domains.
- Returns a `RuleSignal` with evidence.
- Default weight is `0.70`.

### AEG-2-3: Typosquatting Rule

Priority: P0  
Estimate: 3 hours  
Depends on: AEG-2-1

Acceptance criteria:

- Bundled protected-brand list exists.
- Computes edit distance against brand eTLD+1 values.
- Fires when distance is at or below threshold and domain is not exact legitimate domain.
- Returns matched brand and distance.
- Runs under 5 ms for configured brand list.
- Tests include `paypa1.example`, exact legitimate domains, and unrelated domains.

### AEG-2-4: Punycode And Homograph Rule

Priority: P1  
Estimate: 2 hours  
Depends on: AEG-2-1

Acceptance criteria:

- Detects `xn--` labels.
- Detects mixed-script confusables where practical.
- Decodes punycode for explanation display.
- Tests cover known homograph fixtures.

### AEG-2-5: Suspicious TLD And Subdomain Rule

Priority: P1  
Estimate: 1 hour  
Depends on: AEG-2-1

Acceptance criteria:

- Suspicious TLD list is configurable.
- Excessive subdomain threshold is configurable.
- TLD and subdomain findings are separate signals.

### AEG-2-6: Credential Keyword Rule

Priority: P1  
Estimate: 1 hour  
Depends on: AEG-2-1

Acceptance criteria:

- Keyword list is configurable.
- Matches path, query, and fragment case-insensitively.
- Returns matched keywords.

### AEG-2-7: Structural Anomaly Rule

Priority: P2  
Estimate: 2 hours  
Depends on: AEG-2-1

Acceptance criteria:

- Detects `@` tricks.
- Detects excessive URL length.
- Detects URL-in-URL redirects.
- Detects high percent-encoding.

### AEG-2-8: Rules Engine Orchestrator

Priority: P0  
Estimate: 2 hours  
Depends on: AEG-2-2, AEG-2-3, AEG-2-4, AEG-2-5, AEG-2-6

Acceptance criteria:

- `RulesEngine.analyze(parsedUrl)` returns `RulesResult`.
- Every rule result is preserved.
- Overall rule score is deterministic.
- Typical runtime under 10 ms.
- Tests cover safe, suspicious, and phishing examples.

## Epic 3: Layer 2 - Local ML Classifier

Goal: train an offline classifier and run ONNX inference entirely in the browser.

### AEG-3-1: Acquire And Merge Training Datasets

Priority: P0  
Estimate: 2 hours  
Depends on: none

Acceptance criteria:

- Dataset builder supports PhishTank, OpenPhish, and Tranco inputs.
- Output CSV has `url`, `is_phishing`, `source`, `observed_at`.
- Duplicates removed.
- Dataset licensing notes documented.

### AEG-3-2: Feature Engineering Pipeline

Priority: P0  
Estimate: 3 hours  
Depends on: AEG-3-1

Acceptance criteria:

- Python `extract_features(url)` returns fixed-order features.
- `training/FEATURES.md` documents every feature.
- Feature set includes rule-derived and statistical URL features.
- Pipeline outputs `features.parquet`.

### AEG-3-3: Train And Evaluate Classifier

Priority: P0  
Estimate: 2 hours  
Depends on: AEG-3-2

Acceptance criteria:

- Stratified train/test split.
- Metrics saved to JSON.
- Confusion matrix saved.
- Target metrics recorded honestly.
- Model saved under `training/artifacts/`.

### AEG-3-4: Export Model To ONNX

Priority: P0  
Estimate: 1 hour  
Depends on: AEG-3-3

Acceptance criteria:

- ONNX export succeeds.
- Python ONNX round-trip predictions match original model within tolerance.
- Final model is under target size.
- Model copied to `public/models/phishing-classifier.onnx`.

### AEG-3-5: Port Feature Extraction To TypeScript

Priority: P0  
Estimate: 3 hours  
Depends on: AEG-3-2

Acceptance criteria:

- `src/ml/features.ts` implements every feature in identical order.
- Output is `Float32Array`.
- Snapshot parity tests compare Python and TypeScript results.
- Runtime under 5 ms per URL.

### AEG-3-6: Integrate ONNX Runtime Web In Worker

Priority: P0  
Estimate: 3 hours  
Depends on: AEG-3-4, AEG-3-5

Acceptance criteria:

- Worker loads model lazily.
- Session is cached.
- Prediction returns probability and metadata.
- Errors return `status: "error"` or `status: "unavailable"`.
- Known phishing fixture returns high risk.

### AEG-3-7: Integrate ML Signal Into Fusion

Priority: P0  
Estimate: 1 hour  
Depends on: AEG-2-8, AEG-3-6

Acceptance criteria:

- Fusion accepts ML result.
- Layer scores preserved.
- Thresholds configurable.
- Missing ML does not count as safe.

## Epic 4: Explanation Layer

Goal: provide clear explanations with deterministic templates and optional local LLM.

### AEG-4-1: WebLLM Proof Of Concept

Priority: P1  
Estimate: 2 hours  
Depends on: none

Acceptance criteria:

- Standalone proof loads selected model on demo hardware.
- Time to first token recorded.
- RAM/VRAM usage recorded.
- Fallback decision documented.

### AEG-4-2: Integrate WebLLM With Lazy Loading

Priority: P1  
Estimate: 3 hours  
Depends on: AEG-4-1, AEG-1-3

Acceptance criteria:

- Model loads only after user requests LLM explanation.
- Download progress shown.
- Model cache behavior documented.
- User can disable LLM.

### AEG-4-3: Prompt Template

Priority: P1  
Estimate: 2 hours  
Depends on: AEG-4-2

Acceptance criteria:

- Prompt accepts structured signals only.
- Prompt forbids invented evidence.
- Output target is 2 to 3 sentences.
- Tests cover safe, suspicious, and phishing cases.

### AEG-4-4: Streaming Output

Priority: P2  
Estimate: 2 hours  
Depends on: AEG-4-3

Acceptance criteria:

- Streaming tokens appear in UI.
- Cancel works.
- Non-streaming fallback exists.

### AEG-4-5: Template Explanation Fallback

Priority: P0  
Estimate: 1 hour  
Depends on: AEG-2-8, AEG-3-7

Acceptance criteria:

- Every rule has a human-readable description.
- Template works without WebGPU or network.
- Explanation includes actionable guidance.
- Used automatically when LLM is disabled or unavailable.

## Epic 5: Privacy-Preserving Threat Intelligence

Goal: use Safe Browsing without sending full URLs.

### AEG-5-1: Register Safe Browsing API Key

Priority: P0  
Estimate: 30 minutes  
Depends on: none

Acceptance criteria:

- API key created.
- Key stored in `.env.local`.
- Key not committed.
- Quota checked.

### AEG-5-2: SHA-256 Hashing And Prefix Extraction

Priority: P0  
Estimate: 1 hour  
Depends on: AEG-1-3

Acceptance criteria:

- Uses Web Crypto API.
- Returns full hash and 4-byte prefix locally.
- Tests use known vectors.

### AEG-5-3: Safe Browsing Hash-Prefix Integration

Priority: P0  
Estimate: 4 hours  
Depends on: AEG-5-1, AEG-5-2

Acceptance criteria:

- Does not send full URL.
- Stores local prefix data.
- Requests full hashes only for matching prefixes.
- Final match happens locally.
- Audited network wrapper records calls.
- Test URL path works.

### AEG-5-4: Threat-Intel Signal Into Fusion

Priority: P0  
Estimate: 1 hour  
Depends on: AEG-5-3, AEG-3-7

Acceptance criteria:

- Threat-intel result included in `AnalysisResult`.
- Confirmed malicious match elevates verdict.
- UI shows provider and privacy mode.

## Epic 6: Visual Brand Impersonation

Goal: detect brand spoofing using consent-gated visual analysis.

### AEG-6-1: Consent-Gated Offscreen Visual Inspector

Priority: P1  
Estimate: 3 hours  
Depends on: AEG-1-3, AEG-10-1

Acceptance criteria:

- Visual inspection disabled by default.
- Consent prompt appears before target-origin request.
- Offscreen document uses strict CSP.
- Audit log records target-origin contact.

### AEG-6-2: Brand pHash Database

Priority: P1  
Estimate: 2 hours  
Depends on: none

Acceptance criteria:

- Top brand login-page hashes generated from safe controlled process.
- JSON contains brand, legitimate domains, pHash, source date.
- File stored under `public/data/brand-hashes.json`.
- Licensing and capture notes documented.

### AEG-6-3: In-Browser Perceptual Hashing

Priority: P1  
Estimate: 2 hours  
Depends on: AEG-6-1

Acceptance criteria:

- Computes 64-bit perceptual hash from rendered/screenshot canvas.
- Hash format matches database.
- Runtime under 100 ms for fixture.

### AEG-6-4: Similarity Matching And Verdict Signal

Priority: P1  
Estimate: 2 hours  
Depends on: AEG-6-2, AEG-6-3

Acceptance criteria:

- Computes Hamming distance.
- Flags close visual match on non-legitimate domain.
- Returns matched brand, distance, and confidence.
- Fusion and UI show consent and target-origin behavior.

## Epic 7: Email And Browser Integration

Goal: scan webmail links and browser-hovered links before the user clicks.

### AEG-7-1: Gmail Open-Email Link Extraction

Priority: P0  
Estimate: 3 hours  
Depends on: AEG-1-3

Acceptance criteria:

- Content script injects only on Gmail.
- `MutationObserver` detects open message changes.
- Extracts anchor `href` values.
- Sends minimal URL context to background.
- Cleans observers across SPA navigation.

### AEG-7-2: Gmail Inline Badge UI

Priority: P0  
Estimate: 2 hours  
Depends on: AEG-7-1, AEG-3-7

Acceptance criteria:

- Badges render beside scanned links.
- Colors map to verdicts.
- Tooltip shows reason.
- Badge click opens detail flow.
- Gmail layout remains usable.

### AEG-7-3: Email Header Signals

Priority: P1  
Estimate: 3 hours  
Depends on: AEG-7-1

Acceptance criteria:

- Header extraction works only when reliable UI data is available.
- SPF, DKIM, and DMARC parsed from visible/authenticated header source.
- Missing headers produce `not_available`, not false pass.
- Signals shown separately from URL verdict.

### AEG-7-4: Outlook Web Content Script

Priority: P2  
Estimate: 3 hours  
Depends on: AEG-7-1

Acceptance criteria:

- Content script injects on Outlook Web domains.
- Link extraction mirrors Gmail architecture.
- Shared badge components reused.

### AEG-7-5: Generic Hover Scanner

Priority: P0  
Estimate: 2 hours  
Depends on: AEG-1-3

Acceptance criteria:

- Passive hover listener scans links after debounce.
- Non-safe verdict shows mini warning.
- Trusted-domain whitelist respected.
- No excessive repeated scans.

## Epic 8: User Awareness And Micro-Training

Goal: turn a blocked threat into a short local learning moment.

### AEG-8-1: Micro-Training Overlay

Priority: P1  
Estimate: 3 hours  
Depends on: AEG-7-2

Acceptance criteria:

- Non-modal overlay after phishing verdict.
- Shows spoofed brand or key giveaway.
- Includes one multiple-choice question.
- User can dismiss immediately.

### AEG-8-2: Progress Tracking

Priority: P2  
Estimate: 2 hours  
Depends on: AEG-8-1, AEG-1-4

Acceptance criteria:

- Tracks threats blocked, trainings completed, streak.
- Stored locally only.
- Clear-cache resets progress after confirmation.

### AEG-8-3: LLM-Generated Training Content

Priority: P2  
Estimate: 2 hours  
Depends on: AEG-4-3, AEG-8-1

Acceptance criteria:

- Local LLM generates question from structured signals only.
- Cached per URL hash.
- Template fallback exists.

## Epic 9: UI And Verdict Display

Goal: create a fast, trustworthy, consistent interface.

### AEG-9-1: Design System

Priority: P0  
Estimate: 2 hours  
Depends on: AEG-1-1

Acceptance criteria:

- Tailwind config defines palette, spacing, typography.
- Components include Button, Badge, Tooltip, ProgressBar, Toggle, and Panel.
- Accessibility states defined.

### AEG-9-2: Popup Main View

Priority: P0  
Estimate: 3 hours  
Depends on: AEG-9-1, AEG-1-4

Acceptance criteria:

- Shows protection toggle.
- Shows recent verdicts.
- Shows scan counters.
- Loads under 200 ms.

### AEG-9-3: Verdict Detail Panel

Priority: P0  
Estimate: 3 hours  
Depends on: AEG-9-2, AEG-2-8, AEG-3-7

Acceptance criteria:

- Shows each layer score and status.
- Shows fired signals.
- Shows privacy summary.
- Has explanation button.

### AEG-9-4: Settings And Options Page

Priority: P1  
Estimate: 2 hours  
Depends on: AEG-9-1, AEG-1-4

Acceptance criteria:

- Layer toggles.
- Trusted-domain list.
- Telemetry opt-in default off.
- Clear local cache.
- Privacy audit tab.

### AEG-9-5: Onboarding

Priority: P1  
Estimate: 2 hours  
Depends on: AEG-9-1

Acceptance criteria:

- Opens on first install.
- Explains what stays local.
- Guides user to pin extension.
- Includes skip option.

## Epic 10: Privacy Audit And Transparency

Goal: make privacy claims inspectable.

### AEG-10-1: Network Call Audit Log

Priority: P0  
Estimate: 2 hours  
Depends on: AEG-1-4

Acceptance criteria:

- Centralized audited fetch wrapper.
- Records destination, purpose, data category, byte counts, status.
- Visible in options page.
- TTL cleanup works.

### AEG-10-2: Live Transparency Panel

Priority: P1  
Estimate: 2 hours  
Depends on: AEG-10-1

Acceptance criteria:

- Popup shows in-flight analyses.
- Shows layers running.
- Shows whether data left the device.
- Updates in real time.

### AEG-10-3: One-Click Privacy Verifier

Priority: P0  
Estimate: 2 hours  
Depends on: AEG-10-1

Acceptance criteria:

- Runs fixture scan.
- Captures network calls.
- Shows pass/fail checks.
- Proves no email content or full URL in default flow.
- Completes under 5 seconds for fixture.

### AEG-10-4: Open-Source Readiness

Priority: P2  
Estimate: 1 hour  
Depends on: none

Acceptance criteria:

- License added.
- README explains privacy architecture.
- Secrets and datasets excluded.
- Contribution notes added if repository becomes public.

## Epic 11: Testing, Performance, And QA

Goal: keep the demo and product reliable.

### AEG-11-1: Unit Tests For Rules And Features

Priority: P0  
Estimate: 3 hours  
Depends on: AEG-2-8, AEG-3-5

Acceptance criteria:

- Vitest configured.
- Rules and feature extractors covered.
- Coverage target above 80 percent for core detection modules.

### AEG-11-2: Playwright E2E Gmail Fixture Test

Priority: P1  
Estimate: 3 hours  
Depends on: AEG-7-2

Acceptance criteria:

- Loads built extension in Chromium.
- Opens local Gmail-like fixture.
- Verifies badges and detail flow.
- Runs in CI.

### AEG-11-3: Performance Budget Enforcement

Priority: P1  
Estimate: 2 hours  
Depends on: AEG-2-8, AEG-3-6

Acceptance criteria:

- Measures at least 100 URLs.
- Reports P50, P90, P95, max.
- Fails when budget exceeded.

### AEG-11-4: Curated Demo Fixture Set

Priority: P0  
Estimate: 1 hour  
Depends on: none

Acceptance criteria:

- At least 20 fixture URLs.
- Expected verdict for each.
- Layer expected to fire for each.
- No live phishing dependencies.

### AEG-11-5: Cross-Browser Smoke Test

Priority: P2  
Estimate: 1 hour  
Depends on: AEG-1-2

Acceptance criteria:

- Manual smoke checklist run on supported browsers.
- Browser-specific issues documented.

## Epic 12: Demo, Pitch, And Documentation

Goal: package the product into a credible presentation.

### AEG-12-1: Pitch Deck

Priority: P0  
Estimate: 3 hours  
Depends on: none

Acceptance criteria:

- Covers problem, failure of current solutions, architecture, demo, privacy proof, roadmap, and team.
- Slides are concise.
- Exported to PDF.

### AEG-12-2: Live Demo Script

Priority: P0  
Estimate: 2 hours  
Depends on: AEG-11-4

Acceptance criteria:

- Five-minute script.
- Each step has action, expected result, fallback.
- Includes DevTools privacy proof.
- Rehearsed at least three times.

### AEG-12-3: Video Recording Fallback

Priority: P1  
Estimate: 1 hour  
Depends on: AEG-12-2

Acceptance criteria:

- 60 to 90 second recording.
- Stored locally on demo laptop.
- Shows full flow.

### AEG-12-4: Public README And Landing Page

Priority: P1  
Estimate: 2 hours  
Depends on: AEG-10-4

Acceptance criteria:

- README includes problem, solution, architecture, setup, docs map, privacy model, and roadmap.
- Optional landing page links to repo and demo.

### AEG-12-5: Q&A Preparation

Priority: P0  
Estimate: 1 hour  
Depends on: none

Acceptance criteria:

- At least 15 likely judge questions.
- Answers cover privacy, novelty, false positives, novel attacks, mobile, and business model.
- Team reviews before presentation.

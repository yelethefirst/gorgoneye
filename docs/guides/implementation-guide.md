# End-To-End Implementation Guide

This guide converts the original implementation plan into an ordered build path. It is written for a developer joining the project with no prior context.

## Implementation Principles

1. Preserve privacy claims before adding features.
2. Keep every milestone demoable.
3. Build typed contracts before building complex modules.
4. Use fixtures for repeatability.
5. Add tests close to the code that creates risk.
6. Make optional layers genuinely optional.
7. Prefer clear user-facing explanations over hidden scores.

## Milestone 0: Project Foundation

Goal:

- Create a working extension skeleton that can be loaded in Chrome.

Build:

- WXT TypeScript React scaffold.
- `pnpm` scripts.
- ESLint, Prettier, Vitest, TypeScript config.
- Entry points for background, popup, options, Gmail content script, and generic content script.
- Shared message contracts from [data contracts](../architecture/data-contracts.md).
- Basic storage wrapper.

Acceptance:

- `pnpm dev` starts WXT.
- Extension loads in Chrome.
- Popup opens.
- Content script sends a stub `ANALYZE_URL` message.
- Background returns a stub verdict.
- Unit test runner works.

## Milestone 1: URL Rules Engine

Goal:

- Analyze any URL locally in under 10 ms and return interpretable signals.

Build:

- URL parser and canonicalizer.
- Brand-domain data file.
- Rule modules for IP hostnames, punycode, mixed scripts, typosquatting, suspicious TLDs, credential keywords, `@` tricks, excessive length, and URL-in-URL redirects.
- Rules orchestrator.
- Rule signal descriptions for UI and explanation templates.

Acceptance:

- Rules return a stable `RulesResult`.
- At least 20 parser edge cases covered.
- At least 10 phishing and 10 legitimate URL tests.
- No raw email content is needed or accepted by rule APIs.

Implementation notes:

- Use `new URL()` and `tldts`.
- Do not hand-roll URL parsing with regex.
- Keep all rule weights in a single constants file.
- Store brand domains as eTLD+1 values.

## Milestone 2: Fusion And Verdict UI Skeleton

Goal:

- Turn rule output into user-visible verdicts.

Build:

- Fusion module.
- Verdict types and thresholds.
- Popup main view with recent verdicts.
- Verdict detail panel with layer breakdown.
- Gmail/local fixture badge renderer.

Acceptance:

- A suspicious test URL shows a badge.
- Popup shows fired signals and confidence.
- Safe, suspicious, phishing, and unknown states are visually distinct.
- Missing layers are shown as unavailable, not as safe.

## Milestone 3: Local ML

Goal:

- Train and run a local classifier.

Build:

- Dataset builder.
- Feature extraction in Python.
- Model training script.
- Evaluation output.
- ONNX export.
- TypeScript feature extractor.
- ONNX worker integration.
- Feature parity tests.

Acceptance:

- Training artifacts generated.
- `FEATURES.md` documents every feature.
- ONNX model loads in browser worker.
- Known phishing fixture returns high probability.
- Python and TypeScript feature arrays match for snapshot fixtures.

Implementation notes:

- Feature schema order is a release contract.
- Store `modelVersion` and `featureSchemaVersion` in results.
- Keep initial model small; a good demo model is better than a perfect but heavy model.

## Milestone 4: Safe Browsing Hash-Prefix Threat Intelligence

Goal:

- Add external threat intelligence without sending full URLs.

Build:

- URL canonicalization compatible with Safe Browsing expectations.
- SHA-256 hash and prefix extraction.
- Safe Browsing update/full-hash lookup module.
- Local prefix storage.
- Audited network wrapper.
- Fusion integration.

Acceptance:

- Full scanned URL is absent from network payloads.
- Hash prefix is visible in the audit log.
- Vendor test URL returns expected result.
- Safe Browsing unavailable state does not block normal browsing.

Implementation notes:

- Do not use full-URL lookup.
- Tests should fail if request body or query params contain the scanned URL.
- Audit every request before and after it runs.

## Milestone 5: Gmail Integration

Goal:

- Protect a user while reading Gmail.

Build:

- Gmail content script.
- `MutationObserver` for open messages.
- Link extraction from active message body.
- Badge placement beside links.
- Tooltip and click behavior.
- Observer cleanup across SPA navigation.

Acceptance:

- Local Gmail-like fixture shows badges.
- Real Gmail manual smoke test works.
- Badges do not break layout.
- Links are scanned once and updated from cache.
- No email body text is sent to background.

Implementation notes:

- Use stable wrapper selectors where possible, but expect Gmail DOM changes.
- Keep a fixture that mimics the minimum required Gmail structure.
- Do not scrape entire email text just to find links.

## Milestone 6: Privacy Audit And Verification

Goal:

- Make the privacy claim demonstrable.

Build:

- Audit log storage.
- Options page audit table.
- One-click verifier.
- Privacy summary in analysis results.
- Tests that inspect outgoing requests.

Acceptance:

- Verifier runs a fixture scan.
- UI shows no email content sent.
- UI shows no full URL sent to threat intelligence.
- Audit log includes hash-prefix request and byte counts.
- Audit log expires after retention period.

Implementation notes:

- This should be in the demo before LLM or visual inspection.
- The privacy verifier is a product feature, not only a test.

## Milestone 7: Explanation Engine

Goal:

- Explain verdicts in plain language.

Build:

- Template explanation generator.
- Rule description catalog.
- Prompt builder for local LLM.
- Optional WebLLM integration.
- Streaming UI.
- Cancel behavior.

Acceptance:

- Template explanation works without WebGPU.
- LLM prompt includes structured signals only.
- LLM output does not invent evidence in sample tests.
- User can disable LLM.
- Model download progress is visible.

Implementation notes:

- Explanation is post-verdict and should not block warning display.
- Treat the LLM as enhancement, not as detection authority.

## Milestone 8: Optional Visual Inspection

Goal:

- Detect brand impersonation when the user consents or a local fixture is used.

Build:

- Consent UI.
- Offscreen document.
- Strict CSP.
- Local screenshot/pHash pipeline.
- Brand hash database.
- Fusion integration.
- Audit event for target-origin contact.

Acceptance:

- Visual inspection is disabled by default.
- User sees a consent prompt before remote target-origin request.
- Screenshot never leaves device.
- pHash match produces a clear brand-impersonation signal.
- Audit log records target-origin contact when it happens.

Implementation notes:

- Do not silently render every email link.
- Demo can use a local fixture to avoid contacting a real phishing host.

## Milestone 9: Micro-Training

Goal:

- Turn blocked threats into short teaching moments.

Build:

- Non-modal overlay.
- One-question training card.
- Local progress counters.
- Template and optional LLM-generated questions.

Acceptance:

- Training appears only after phishing verdicts.
- User can dismiss instantly.
- Progress is stored locally.
- No training data is uploaded.

## Milestone 10: QA, Demo, And Hardening

Goal:

- Make the product reliable enough to present.

Build:

- E2E fixture tests.
- Performance tests.
- Cross-browser smoke checklist.
- Demo URL/fixture set.
- Demo script.
- README updates.
- Risk register review.

Acceptance:

- P0 tests pass.
- Performance budget passes.
- Privacy verifier passes.
- Demo rehearsed end to end.
- Fallback recording exists.

## Recommended Build Order By Ticket

Fastest stable path:

1. AEG-1-1, AEG-1-3, AEG-1-4.
2. AEG-2-1, AEG-2-2, AEG-2-3, AEG-2-6, AEG-2-8.
3. AEG-9-1, AEG-9-2, AEG-9-3.
4. AEG-7-5, then AEG-7-1 and AEG-7-2.
5. AEG-3-1 through AEG-3-7.
6. AEG-5-1 through AEG-5-4.
7. AEG-10-1 through AEG-10-3.
8. AEG-4-5, then AEG-4-1 through AEG-4-4 if hardware allows.
9. AEG-8-1.
10. AEG-6-1 through AEG-6-4 only after consent model is implemented.
11. AEG-11 and AEG-12 tickets continuously throughout.

## Cutline

If time is tight, cut in this order:

1. Visual inspection.
2. LLM-generated micro-training.
3. Outlook integration.
4. WebLLM streaming.
5. Cross-browser support beyond Chrome.

Do not cut:

- Rules.
- Fusion.
- Gmail or fixture-based email demo.
- Privacy audit.
- Hash-prefix threat-intelligence proof if API access is available.
- Template explanations.

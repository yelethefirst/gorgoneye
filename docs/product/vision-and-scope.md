# Product Vision And Scope

## One-Sentence Vision

Aegis Gorgon protects users from phishing inside their browser while keeping sensitive email content local and making every privacy-sensitive operation visible and auditable.

## Product Promise

The user should be able to trust this statement:

> Aegis Gorgon can inspect phishing risk without reading, collecting, or sending your email content to a cloud AI system.

That promise is more important than any single detection layer. If a feature conflicts with it, the feature must be redesigned, consent-gated, or removed from the default path.

## Primary Users

| User | Need | Product Response |
| --- | --- | --- |
| Individual Gmail or Outlook user | Understand whether a suspicious link is safe before clicking. | Inline badges, hover scanning, popup explanations, and micro-training. |
| Small business operator | Get phishing protection without enterprise mail-gateway setup. | Browser-extension deployment, local-first detection, and simple defaults. |
| Regulated professional | Avoid sending sensitive emails to third-party AI systems. | No email-content exfiltration, local LLM option, privacy audit log. |
| Hackathon judge or security reviewer | Verify that the product is technically credible and privacy-preserving. | Layer breakdown, network-call audit, one-click privacy verifier, reproducible demo. |
| Future enterprise admin | Centrally manage policy without collecting employee email content. | Roadmap item: policy console, managed allowlists, opt-in aggregate telemetry. |

## Problems To Solve

- Users face phishing at the point of decision, often inside email clients.
- Cloud AI phishing checkers require copying sensitive content into a third-party service.
- Blocklists are fast but do not explain why something is suspicious.
- Enterprise tools are expensive and unavailable to many users.
- Many awareness products train users after the fact rather than intervening during the risky action.

## Differentiation

| Capability | Cloud AI Checker | Enterprise Email Gateway | Browser Blocklist | Aegis Gorgon |
| --- | --- | --- | --- | --- |
| Runs at point of attack | No | Yes | Yes | Yes |
| Avoids email-content upload | No | Sometimes | Yes | Yes |
| Explains verdicts | Yes | Sometimes | No | Yes |
| Uses multiple detection layers | No | Yes | Limited | Yes |
| Works for individuals | Yes | Usually no | Yes | Yes |
| Auditable privacy behavior | Limited | Limited | Limited | Product requirement |

## In Scope

MVP scope:

- Browser extension using WXT, TypeScript, and Manifest V3.
- Gmail content script for open-email link extraction.
- Generic hover-based link scanner.
- Rule-based URL analysis.
- Offline-trained ONNX classifier running locally.
- Safe Browsing hash-prefix threat-intelligence lookup.
- Fusion engine with layer-level evidence.
- Popup, options page, and inline Gmail badges.
- Privacy audit log.
- One-click privacy verification flow.
- Comprehensive implementation and demo documentation.

Strong-demo scope:

- Optional WebLLM explanation flow with template fallback.
- Micro-training overlay after a phishing verdict.
- Curated demo fixtures and 5-minute pitch script.
- Outlook Web content script if the Gmail path is stable.

Production-hardening scope:

- Signed model releases.
- Enterprise policy controls.
- Accessibility and localization.
- More formal threat modeling and model evaluation.
- Browser-store review preparation.

## Out Of Scope For MVP

- Native mobile app.
- Server-side mail gateway.
- Automatic remote rendering of every email link.
- Collection of raw email content for training.
- Cloud LLM explanation service.
- User behavior tracking across unrelated browsing sessions.
- Blocking all browsing by default.
- Automated takedown or abuse-report submission.

## Success Metrics

Technical:

- P50 URL analysis latency under 100 ms, excluding optional LLM and visual inspection.
- P95 URL analysis latency under 300 ms, excluding optional LLM and visual inspection.
- Rules and feature extraction covered by unit tests.
- Python-to-TypeScript feature parity snapshots pass.
- ONNX model predictions match Python baseline within agreed tolerance.
- Privacy verifier shows no email content, full URLs, screenshots, feature vectors, or LLM prompts in outbound calls.

Product:

- User sees a clear verdict before clicking a risky email link.
- Popup explains which layers fired and why.
- User can disable optional layers.
- User can inspect local audit records.
- Demo can be completed in five minutes with a fallback recording.

Privacy:

- Telemetry defaults off.
- Safe Browsing uses hash-prefix flow, not full-URL lookup.
- Visual inspection is disabled by default for unopened email links.
- LLM prompts contain structured signals only.
- Audit log records destination, purpose, byte count, and data category for every extension network call.

## Release Strategy

The safest delivery order is:

1. Local rules and UI proof of value.
2. Local ML and fusion for stronger detection.
3. Privacy-preserving threat intelligence.
4. Privacy audit and verification.
5. Explanation and training features.
6. Visual inspection only after the privacy consent model is implemented.

This order keeps every milestone demoable and protects the core privacy promise.

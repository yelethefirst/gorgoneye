# Judge Q&A Prep

Eighteen anticipated judge questions with structured answers, grouped by theme.
Each entry has a short answer for the live response, an "If pressed" follow-up
for a second question, and a code/doc reference for proof. The bottom of this
doc has a review-log template the team fills in before presenting.

Cross-references:
- [Demo playbook](demo-playbook.md)
- [Privacy and threat model](../architecture/privacy-and-threat-model.md)
- [Privacy verification guide](privacy-verification.md)
- [Implementation guide](implementation-guide.md)

## Privacy

### 1. How do you actually prove email content never leaves the device?

**Short answer.** The audit-record type has `containsEmailContent: false` as a
literal — it is structurally impossible to log an email-bearing record. The
`auditedFetch` wrapper has no parameter for email content. The privacy verifier
runs the full pipeline with isolated stores and asserts seven privacy
invariants, all green on every build.

**If pressed.** Open the options page → **Run verification** → expand the
seven checks. They include "No audit record carries email content" and
"`AnalysisResult.privacy` summary clean".

**Reference.** [`src/shared/audit.ts`](../../src/shared/audit.ts),
[`src/audit/auditedFetch.ts`](../../src/audit/auditedFetch.ts),
[`src/privacy/verifier.ts`](../../src/privacy/verifier.ts).

### 2. How is Safe Browsing different from sending the URL?

**Short answer.** We canonicalize the URL locally, enumerate up to 30
host-suffix × path-prefix expressions, SHA-256 hash each one, and send only
the first 4 bytes of the hashes that match a prefix in the local database.
Even the full hash never leaves the device; only the prefix.

**If pressed.** The `auditedFetch` body-policy guard rejects any body that
contains `http(s)://` unless the call is a consented `target_origin_request`.
Safe Browsing calls fail that check structurally if a URL ever slipped in.

**Reference.**
[`src/threat-intel/safeBrowsing.ts`](../../src/threat-intel/safeBrowsing.ts),
[`src/audit/auditedFetch.ts`](../../src/audit/auditedFetch.ts).

### 3. What about telemetry?

**Short answer.** Off by default, and there is no implementation behind the
opt-in toggle today. The toggle exists so the user's consent state can be
recorded *before* any telemetry code is written.

**If pressed.** When telemetry lands, it will use `dataCategory:
"scrubbed_telemetry"` and the verifier already asserts that no
scrubbed-telemetry calls happen in the default flow.

**Reference.** [`src/storage/settings.ts`](../../src/storage/settings.ts)
default `telemetryOptIn: false`,
[`src/ui/options/TelemetryPanel.tsx`](../../src/ui/options/TelemetryPanel.tsx).

### 4. What if the user enables visual brand inspection?

**Short answer.** Visual inspection is the only path where a full URL goes
to a remote origin, and it requires *explicit per-scan consent*. The user
sees a prompt every time. The audit log records `target_origin_request` for
that call, and the live transparency panel flips its traffic light to red.

**If pressed.** Visual inspection ships in this build behind a default-off
toggle. The flow is: VerdictDetailPanel surfaces an "Inspect visually"
button (only when the layer is enabled in settings), clicking it opens an
`alertdialog` `ConsentPrompt` with the three required disclosure lines
from ADR-0013 (action, data, privacy), and `Cancel` is the
default-focused action. The user's decision — *both* consent and
decline — is written to the audit log as a `target_origin_request` row;
declines still write a row so the audit trail shows the user said no.
The `auditedFetch` wrapper hard-fails if `containsFullScannedUrl=true` is
set without `userConsented=true` and
`dataCategory="target_origin_request"` — the privacy verifier exercises
this code path and includes it in the green checks.

**Reference.** [`docs/adrs/0008-consent-gated-visual-inspection.md`](../adrs/0008-consent-gated-visual-inspection.md).

### 5. Are the privacy guarantees compile-time or runtime?

**Short answer.** Both. The `AuditRecord` type has `containsEmailContent:
false` as a literal type (compile-time). The `auditedFetch` body-policy
guard (runtime) rejects URL-in-body calls outside consented inspection. The
verifier (test-time) asserts the invariants on every CI run. Three layers of
defense for the same promise.

## Differentiation / Novelty

### 6. How is this different from asking ChatGPT to check a URL?

**Short answer.** ChatGPT needs the user to copy text into a third-party
service — Aegis runs *before* the user is suspicious, at the moment of
hovering or opening a link, and the email content never leaves the device.
Aegis also gives a layer-by-layer breakdown the user can audit; a chatbot
gives an opinion the user has to trust.

**If pressed.** Speed matters. Our P50 is 0.13 ms per URL; a chatbot round-
trip is at least 1–2 s plus paste latency.

**Reference.** [`tests/detection/perfBudget.test.ts`](../../tests/detection/perfBudget.test.ts).

### 7. How is this different from a blocklist?

**Short answer.** Blocklists catch known-bad and miss everything novel.
Aegis combines rules (typosquatting against a brand list, homograph,
embedded-credential @-trick, URL-in-URL redirects) with optional Safe
Browsing — so we catch the long tail of "looks like PayPal but isn't" that a
blocklist hasn't seen yet, and we explain *why*.

**If pressed.** Our typosquatting rule fires on `paypa1.example`, `goog1e.com`,
`micr0soft.net` — none of which would be in a blocklist.

**Reference.** [`src/rules/rules/typosquatting.ts`](../../src/rules/rules/typosquatting.ts),
[`src/fixtures/demoFixtures.ts`](../../src/fixtures/demoFixtures.ts).

### 8. Why a browser extension instead of a mail-gateway?

**Short answer.** It reaches the user at the point of decision, doesn't
require admin access to a mail server, works for individuals and small
teams, and protects every web page — not just inbound email. The
historical trade-off was no DKIM/SPF visibility; the Gmail content
script now closes that gap by parsing `Authentication-Results` from the
"Show original" view when the user opens it, surfacing an explicit
`auth_header_fail` signal when any of SPF / DKIM / DMARC fail. Missing
headers report `not_available`, never silently "pass" — we never claim
authentication data we don't have.

## False positives and noise

### 9. Aren't typosquatting rules noisy?

**Short answer.** Three things reduce false positives. We compare against the
*registrable* domain's SLD, not the whole hostname. We use a length-aware
threshold (≤1 edit for SLDs of length ≤5, ≤2 otherwise). And we never fire on
an exact match to a known brand domain.

**If pressed.** `apply.com` won't flag against `apple.com` because the SLD
length-gap pre-filter excludes mismatches > 2 characters. We could tune the
threshold per-brand in a future ticket if needed.

**Reference.** [`src/rules/rules/typosquatting.ts`](../../src/rules/rules/typosquatting.ts).

### 10. What if a legit credential page triggers the keyword rule?

**Short answer.** The credential-keywords rule has weight 0.30. On its own it
produces a *Suspicious* verdict, not *Phishing*. The thresholds in
[`src/detection/fusion.ts`](../../src/detection/fusion.ts) require ≥0.75 for
phishing, which needs multiple independent strong signals. A clean URL on a
real bank's login page lands at exactly 0.30 — suspicious-but-passable.

**If pressed.** Users can add `bank.com` to the trusted-domain list on the
options page; trusted hosts are skipped by the hover scanner entirely.

## Novel attacks

### 11. What about attacks that don't use a URL at all? (QR codes, calls)

**Short answer.** Aegis is explicitly URL-focused — that's the wedge it
solves well. We aren't trying to be a universal anti-phishing product.
For QR codes, scanning happens on a phone, which is also outside scope.
The point of the wedge is that the browser is the largest attack surface and
we cover it correctly.

### 12. What about attacks that use a brand-new typosquat domain?

**Short answer.** The typosquatting rule is the brand list, not a blocklist —
it doesn't care if the squat is new. As long as the *brand* is on our
protected list, any new typosquat against it fires. We curate the brand
list, not the attacker list.

**Reference.** [`src/rules/data/brandDomains.ts`](../../src/rules/data/brandDomains.ts) (33 brands today).

### 13. What about IDN homograph attacks where the punycode is single-script?

**Short answer.** The punycode rule fires on *any* `xn--` label, so a pure
Cyrillic spoof of `apple.com` (which encodes as `xn--80ak6aa92e.com`) still
warns. The mixed-script half of the rule additionally catches partial
substitutions like `аpple.com` (Cyrillic `а`).

**Reference.** [`src/rules/rules/punycodeHomograph.ts`](../../src/rules/rules/punycodeHomograph.ts).

## Reliability and performance

### 14. What happens if Safe Browsing is down?

**Short answer.** The threat-intel layer is marked `unavailable` with the
error message, the rules layer keeps running, and the verdict is computed
without that input. The privacy summary then accurately reports that no
hash prefix was sent. The user sees a graceful degradation; nothing blocks.

**If pressed.** This is tested directly:
`tests/threat-intel/safeBrowsing.test.ts` "returns unavailable when the
network throws".

### 15. How fast is it?

**Short answer.** Today's perf-budget test measures P50 = 0.13 ms, P95 =
0.50 ms across 120 URLs end-to-end (rules + fusion). The product budget is
P50 < 100 ms, P95 < 300 ms — three orders of magnitude of headroom. The
budget test fails CI if that ever stops being true.

**Reference.** [`tests/detection/perfBudget.test.ts`](../../tests/detection/perfBudget.test.ts).

### 16. What's the service-worker suspension story?

**Short answer.** MV3 service workers can suspend. We persist settings, the
verdict cache, the audit log, and the prefix DB in `chrome.storage.local`.
No in-flight analysis state crosses a suspension boundary because analyses
are sub-millisecond and never await a network response without a fresh
request ID.

## Roadmap, mobile, and business model

### 17. What about mobile?

**Short answer.** Out of scope for v1. Browser extensions aren't supported
on iOS Safari and only marginally on Android. The clean wedge is desktop
browser → webmail. Mobile gets a different architecture entirely (a system
share-sheet extension or a network-level resolver) and is a future product,
not a future feature.

### 18. What's the business model?

**Short answer.** Free for individuals — same install, same protections.
Enterprise adds an admin console: policy management (forced trusted-domain
lists, layer-toggle constraints, audit-log retention), centralized rollouts
of brand-domain updates, and opt-in scrubbed aggregate telemetry that
*never* includes URLs, content, prompts, or feature vectors. The privacy
posture is the moat — companies whose employees would never paste a
sensitive email into ChatGPT can deploy Aegis at scale without breaching
that boundary.

**If pressed.** The same `auditedFetch` wrapper enforces the
"no URL, no content" rule on enterprise telemetry by construction — it's
literally the same code path.

## Review Log

The acceptance criteria require the team to review this doc before
presenting. Fill in after each pass.

| Reviewer | Date | Notes / edits made | Approved? |
| --- | --- | --- | --- |
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |

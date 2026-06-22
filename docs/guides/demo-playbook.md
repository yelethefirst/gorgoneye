# Demo Playbook

## Demo Goal

Show that Aegis Gorgon protects the user at the moment of decision — the second before they click a phishing link — and **prove** the protection does not require uploading email content or full URLs to any cloud service.

This playbook is calibrated against the shipped build. All twelve epics ship — the rules engine, the local ML classifier, the local LLM explanation path, Safe Browsing hash-prefix lookup, the consent-gated visual brand inspector, Gmail + Outlook content scripts with SPF/DKIM/DMARC header analysis on Gmail "Show original" view, the post-phishing-verdict training card (template + optional LLM-personalized), and the audit + privacy verifier. The 5-minute script below intentionally keeps the spotlight on the rules engine, privacy verifier, and perf budget because those are the structural claims that distinguish the product; the other layers ship default-off behind opt-in toggles and are demoed only if a judge asks. If you want to add a beat for visual inspection or the LLM explanation, shrink Beat 5 (stability under load) since the perf numbers also appear on the README.

## Pre-Demo Setup (run 5 minutes before)

```bash
pnpm install                                   # idempotent
pnpm build                                     # produces .output/chrome-mv3/
npx --yes serve tests/fixtures                 # http://localhost:3000/gmail-message.html
```

Then in Chrome:

1. Open `chrome://extensions`, enable **Developer Mode**, click **Load unpacked**, pick `.output/chrome-mv3/`.
2. Pin the Aegis Gorgon icon to the toolbar.
3. Open the extension's **options page** and click **Run verification**. Confirm all checks are green. Leave the tab open.
4. Open a fresh tab to `http://localhost:3000/gmail-message.html`. Do NOT hover any links yet — that's beat 2.
5. Open the **popup** once to seed it; close it again.

If anything in this list fails, abort and switch to the recording (see [Failure Plan](#failure-plan)).

## Five-Minute Script

### Beat 1: Hook · 0:00 → 0:30

**Say:**

> The risky moment in phishing isn't when a user asks for help — it's the second before they click. Aegis Gorgon protects that moment locally, on the user's device, without sending their email anywhere.

**Show:** title slide. One-line product promise: *"Your email stays on your device."*

### Beat 2: Link verdicts inline · 0:30 → 1:30

**Action:**

1. Switch to the already-open `gmail-message.html` tab.
2. Hover the "verify your account here" link (`https://paypa1.example/account/verify`). After a short pause, a **red Phishing badge** appears next to it.
3. Hover the "reset your password" link (`https://example.com/r?to=https://attacker.example/login`). An **orange Suspicious badge** appears.
4. Hover the "support center on GitHub" link (`https://github.com/aegishield/aegis-gorgon`). **No badge** — generic-page mode is quiet for safe links by design.
5. Click the red badge. An inline popover lists the fired signals: *Typosquatting brand impersonation*, *Credential-related keywords*.

**Expected result:** three badges, three different verdicts; the popover names the brand being impersonated (PayPal) and the specific signals.

**Say:**

> The badge color is the verdict. The popover tells you *why*. Every rule that fired is a discrete, human-readable signal — not a black box.

**Fallback:** if the hover scanner is slow, scroll once, then re-hover (the MutationObserver re-scans on layout change).

### Beat 3: Popup detail panel · 1:30 → 2:30

**Action:**

1. Open the Aegis popup.
2. Point at the **Protection** panel — protection is on.
3. Point at the **Live transparency** panel — green light, "Nothing left the device", 0 calls.
4. In the **Manual scan** box, paste `http://paypal.com@192.168.0.1/login?next=http://evil.tk/steal`. Click **Scan**.
5. The new entry appears at the top of **Recent verdicts** as a red Phishing badge with high confidence. Click it.
6. The **Verdict detail panel** opens. Walk through:
   - **Layer breakdown** — rules layer is complete with a score; ML/threat-intel/explanation/visual are listed as Unavailable with reasons.
   - **Fired signals** — at minimum: *IP-literal hostname*, *Embedded credentials / @-trick*, *URL embedded inside URL*, *Credential-related keywords*.
   - **Privacy summary** — six green dots: email content stayed on device, no full URL sent to Aegis services, no full URL sent to threat intel, no target-origin request, no telemetry sent.
7. Click **Explain this verdict**. A template explanation appears: a 2–3 sentence summary plus a guidance list ("Do not enter credentials…", "Open the brand's website from a bookmark…").

**Say:**

> Every verdict has a per-layer breakdown, a list of fired signals, and a per-call privacy summary the user can audit themselves. The explanation is generated locally from the structured signals — never from the email body.

**Fallback:** if the popup doesn't render the panel, close it and re-open — settings + audit are fetched in parallel at open time.

### Beat 4: Privacy proof · 2:30 → 3:50

**Action:**

1. Open Chrome DevTools → Network tab. Clear it.
2. Switch back to the popup. Click the **Settings** link (or open `chrome://extensions` → Aegis → Options).
3. Switch to the **Detection** section → flip the **Safe Browsing hash-prefix lookup** toggle **on**.
4. Switch back to the `gmail-message.html` tab. Hover a link that wasn't scanned yet (e.g. the "security site" / `10.0.0.1` link).
5. Re-open the popup. Note the **Live transparency** light is still green (the synthetic test prefix DB is empty, so no Safe Browsing call fired).
6. Switch to the options page. Click **Run verification** at the top. Walk through the seven green checks:
   - No audit record carries email content.
   - No audit record carries the full scanned URL.
   - Threat-intel call used the hash-prefix flow.
   - No telemetry, no target-origin request.
   - `AnalysisResult.privacy` summary clean.
   - Verification completed under the 5 s budget.
7. Expand **Outbound calls during verification** — one POST to `safebrowsing.googleapis.com` carrying `dataCategory=hash_prefix`.

**Say:**

> This is the structural privacy claim, verified end-to-end. The `auditedFetch` wrapper *refuses* to send the full URL outside a consented visual-inspection call. The verifier ran the same code path the user runs, with isolated stores, and recorded every byte that left the device.

**Fallback:** if Run verification stalls, refresh the options page — the verifier is stateless and reruns cleanly. If DevTools is broken, skip step 1; the options page audit table shows the same evidence.

### Beat 5: Stability under load · 3:50 → 4:25

**Action:**

1. Back in the terminal: `pnpm test tests/detection/perfBudget.test.ts`.
2. Wait two seconds for the perf line to print: `analyzeUrl over 120 URLs — mean=~0.2ms P50=~0.13ms P95=~0.4ms`.

**Say:**

> The product budget is P50 under 100 ms, P95 under 300 ms. We're three orders of magnitude under it, with the test failing if that ever stops being true.

**Fallback:** if the terminal isn't visible, show the screenshot from the last CI run instead.

### Beat 6: Close · 4:25 → 5:00

**Say:**

> Aegis combines local rules, privacy-preserving threat intel via hash prefixes, and explainable verdicts — at the point of attack, without the email leaving the device. Every outbound byte is audited; the user can prove the privacy claim themselves with one click. That's the wedge.

**Show:** architecture diagram (from `README.md`). Roadmap slide highlights the open-source release path (extension store submission, brand-pHash DB expansion beyond the seed list, Outlook "View source" header parity) as the natural next steps.

## Demo Asset Locations

| Asset | Path |
| --- | --- |
| Gmail-shaped fixture | [`tests/fixtures/gmail-message.html`](../../tests/fixtures/gmail-message.html) |
| Curated URL fixtures (verdict + expected rules) | [`src/fixtures/demoFixtures.ts`](../../src/fixtures/demoFixtures.ts) |
| Perf budget test | [`tests/detection/perfBudget.test.ts`](../../tests/detection/perfBudget.test.ts) |
| Privacy verifier | [`src/privacy/verifier.ts`](../../src/privacy/verifier.ts) |
| Architecture diagram source | [`README.md`](../../README.md) (top mermaid block) |

## Demo Prep Checklist

- [ ] Primary laptop charged, second monitor disconnected.
- [ ] Backup laptop or 60–90 s recording ready.
- [ ] `pnpm build` produced a fresh `.output/chrome-mv3/`.
- [ ] Extension loaded in a **demo profile** separate from the personal browser profile.
- [ ] `npx serve tests/fixtures` running; `gmail-message.html` reachable at `http://localhost:3000/gmail-message.html`.
- [ ] Privacy verifier run **immediately** before presenting; all green.
- [ ] DevTools Network tab pre-tested and bookmarked.
- [ ] Safe Browsing toggle: off at the start of beat 2, flipped on during beat 4.
- [ ] Telemetry: off. Visual inspection: off.
- [ ] Verdict cache cleared so the popup's Recent verdicts list is empty at start.

## Failure Plan

**Wifi fails:**

- The default path uses only the rules engine (no network). Demo proceeds normally through beat 3.
- For beat 4, skip the Safe Browsing toggle and show the verifier's offline test-mode path; mention the audit log retains the structural proof.

**Extension crashes / "Service worker inactive":**

- Click the **Reload** link under the extension's tile in `chrome://extensions`.
- If it doesn't come back, switch to the recording.

**Hover scanner misses a link:**

- Open the popup and use **Manual scan** with the same URL. The verdict is identical.

**Gmail (real account) breaks the layout:**

- Don't use real Gmail. The fixture page is the primary demo surface.

**Safe Browsing toggle on but no hash-prefix call shows up:**

- That's the expected default — the prefix DB is empty until populated by the Update API (future ticket). Use the **Run verification** path instead; the verifier seeds a synthetic prefix and produces the audit record.

## Calibration Log (3 dry runs minimum before presenting)

Fill in after each rehearsal.

| # | Date | Total time | Beat that ran long | What I changed | Privacy verifier passed? |
| --- | --- | --- | --- | --- | --- |
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |
| 3 |  |  |  |  |  |

## Judge Q&A

The detailed Q&A doc with 18 anticipated questions, structured answers,
"if pressed" follow-ups, and code references lives in
[`docs/guides/judge-qa.md`](judge-qa.md). Read it the night before. Cliff
notes for memory:

- **vs. ChatGPT phishing checker:** protects before the click; doesn't require uploading content.
- **vs. blocklists:** explains the verdict layer-by-layer; catches novel typosquats and homographs the blocklist hasn't seen yet.
- **Novel attacks:** independent layers fused via noisy-OR; one weak signal alone won't block, multiple weak signals together will warn.
- **False positives:** Safe / Suspicious / Phishing is three buckets, not two. Blocking UI requires high-confidence multi-signal evidence.
- **Privacy proof:** run the verifier on demand. The audit log is the same data structure as the one used in the verifier.
- **Browser extension vs. mail-gateway:** reaches users at the point of decision; doesn't require admin access to a mail server; works for individuals, not just enterprises.
- **Business model:** free individual extension, future paid admin console with opt-in scrubbed-aggregate telemetry — no URL or content collection.

# Cross-browser smoke checklist (AEG-11-5)

Run before any tagged release. Each row is a 5–10 minute manual pass against
a real browser tab. Document the result under "Last verified" with date,
browser version, and any observed deviations.

The Playwright E2E suite ([`tests/e2e/badges.spec.ts`](../../tests/e2e/badges.spec.ts))
covers the same scenarios automatically on Chromium-MV3. This checklist is
specifically the **manual** cross-browser pass for everything Playwright
doesn't run today (Firefox MV2, Edge channel parity, Chrome Beta).

## Prerequisites

```bash
pnpm install
pnpm build           # Chrome MV3 → .output/chrome-mv3/
pnpm build:firefox   # Firefox MV2 → .output/firefox-mv2/
npx serve tests/fixtures -p 4173
```

Open each browser in a clean profile so prior settings don't bias the run.

## Per-browser steps

### Chrome stable (MV3)

1. `chrome://extensions` → Developer mode → **Load unpacked** → pick `.output/chrome-mv3/`.
2. Confirm the welcome tab opened. ☐
3. Open `http://127.0.0.1:4173/gmail-message.html`. Hover the phishing link
   (`paypa1.example/account/verify`). A **red Phishing** badge should appear
   within ~300 ms. ☐
4. Hover the URL-in-URL link (`example.com/r?to=...`). An **orange
   Suspicious** badge appears. ☐
5. Hover the GitHub link. No badge (safe-quiet). ☐
6. Click the phishing badge → inline popover shows the URL + at least one
   fired signal + Close button. Close it. ☐
7. Open the toolbar popup → manual scan
   `http://paypal.com@192.168.0.1/login?next=http://evil.tk/steal`. Verdict
   row appears as **Phishing**. Click it → detail panel shows layer
   breakdown + privacy summary + training card. ☐
8. Open the options page → **Run verification** → all seven privacy checks
   green; outbound calls list shows one `safebrowsing.googleapis.com`
   hash-prefix call. ☐
9. In the **Detection** section, toggle **Safe Browsing hash-prefix lookup**
   off. Re-run verification — the hash-prefix audit row disappears; checks
   remain green. ☐
10. In the **Maintenance** section, click **Clear local cache…** twice to
    confirm. Popup's Scan counters reset to 0. ☐

### Edge (Chromium-based)

Repeat the Chrome flow with `.output/chrome-mv3/`. Edge accepts the same
build. ☐

### Firefox stable (MV2)

1. `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** →
   pick `.output/firefox-mv2/manifest.json`.
2. Welcome tab opens. ☐
3. Repeat steps 3–10 from the Chrome flow. Differences to expect:
   - Service worker is implemented as a background page; functionality is
     identical.
   - Popup width may render 1–2 px tighter on Firefox; the layout should
     still be readable.
   - Verifier's `safebrowsing.googleapis.com` call may show a different
     User-Agent in the audit log — that's expected.

### Chrome Beta / Canary

Run a single smoke pass against the same `.output/chrome-mv3/`. The goal is
to catch breaking changes in the upcoming WXT-MV3 surface before they ship
to stable. ☐

## Known browser-specific limitations

| Limitation | Browsers | Notes |
| --- | --- | --- |
| `chrome.runtime.onInstalled` fires later on Firefox MV2 | Firefox | The welcome tab opens; just slower. |
| Inline `<style>` in extension popups may behave slightly differently in dev tools | All | Cosmetic; reload the popup. |
| `chrome.action.openPopup()` requires a user gesture | All | Not used today; relevant when AEG-7-2 deep links from the badge popover. |

## Result log

| Date | Browser | Version | All steps pass? | Notes |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |

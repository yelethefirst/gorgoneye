# ADR-0013: Visual Inspection Consent Flow

## Status

Accepted

## Context

[ADR-0008](0008-consent-gated-visual-inspection.md) established that visual
brand-impersonation analysis is **consent-gated** because rendering a remote
page in an offscreen document discloses a request to the target origin.
That ADR set the principle. This ADR specifies the user-facing flow and the
runtime contract Epic 6 will build against.

The hard constraints we are designing inside:

- **One specific URL per consent.** A blanket "always inspect" toggle is
  unsafe; a single consent must not extend to other links.
- **Consent is visible.** The user must see the URL that will be contacted,
  the data category, and the audit-log entry the action will create —
  *before* they consent.
- **Default is "decline".** No keyboard accelerator (Enter / Space) should
  inadvertently consent. Confirm requires an explicit pointer or keyboard
  selection of a non-default button.
- **The audit log records the consent grant**, not just the network call.
  Reviewers must be able to see "user A consented to inspect URL X at
  time T" without inferring it from the absence of an error.
- **No leaks via the consent UI itself.** The dialog must not pre-fetch the
  target URL, must not load any of its assets, and must not embed its
  favicon or preview text.

## Decision

We add a single consent-prompt component, gated on the
`visualInspection` settings toggle, that fires *every time* a visual
inspection is attempted. The flow has four states.

### State machine

```text
                 ┌───────────────┐
   user clicks   │   IDLE        │
   "Inspect" ───►│ no prompt     │──┐  setting OFF: send message rejected
                 └───────────────┘  │
                                    ▼
                          ┌───────────────────┐
                          │ AWAITING_CONSENT  │
                          │ dialog visible    │
                          │ default = Cancel  │
                          └────┬────────┬─────┘
        user clicks Cancel ────┘        └──── user clicks Inspect
                       │                                  │
                       ▼                                  ▼
                 ┌───────────┐                ┌────────────────────────┐
                 │ DECLINED  │                │ INSPECTING             │
                 │ (no call) │                │ offscreen doc fetches  │
                 │ audit row │                │ target URL; pHash      │
                 └───────────┘                │ computed locally       │
                                              └───────────┬────────────┘
                                                          ▼
                                              ┌────────────────────────┐
                                              │ COMPLETE               │
                                              │ result merged into     │
                                              │ AnalysisResult.layers  │
                                              │ .visual; audit row     │
                                              │ records target-origin  │
                                              │ contact + consent      │
                                              └────────────────────────┘
```

`DECLINED` writes an audit record with:

- `purpose: "visual_inspection_target_origin"`
- `dataCategory: "target_origin_request"`
- `userConsented: false`
- `containsFullScannedUrl: false` (no call happened)
- `requestBytes: 0`, `responseBytes: 0`, `status: undefined`

Why log a no-op? So that the security review can see "consent declined" as
a positive signal, not as a missing event.

`INSPECTING` and `COMPLETE` write the same audit record but with the consent
flag flipped and the actual byte counts.

### Component contract

```ts
interface VisualInspectionConsentRequest {
  /** Display-only URL. Truncated to ≤120 chars to fit the dialog. */
  urlDisplay: string;
  /** The verdict / signals that prompted the request, for context. */
  triggeredBy: { verdict: Verdict; topSignal?: string };
}

interface VisualInspectionConsentResponse {
  decision: "consented" | "declined";
  /** Caller must set this; uniquely keys the consent in the audit log. */
  requestId: string;
}
```

The dialog renders three required pieces of copy, in this order:

1. **Action sentence** — "Aegis is about to fetch `{urlDisplay}` in an
   isolated frame to compare its appearance against a list of legitimate
   brand logins."
2. **Data line** — "Fetching this URL contacts the host. The page's owner
   may see a request from your IP. No URL or content leaves your device."
3. **Privacy line** — "Your decision will be recorded in the local audit
   log as a `target_origin_request`. You can review it on the options
   page."

The two buttons are:

- **Inspect this URL** (primary action, *not* default-focused).
- **Cancel** (default; receives focus on open, accepts `Esc`).

### Settings interaction

`visualInspectionConsentMode` in `UserSettings` (already defined) controls
when the dialog appears:

- `"never"` — visual inspection is impossible; the API call returns
  `status: "unavailable"` with reason "user disabled visual inspection".
  The dialog is never shown.
- `"ask_each_time"` — every attempt opens the dialog. **This is the
  default.**
- `"managed_policy"` — enterprise policy has pre-consented this user;
  inspection runs without the dialog but still writes the audit row with
  `userConsented: true`. The dialog is never shown.

A user can revoke `managed_policy` only if their admin allows it; otherwise
the toggle is read-only on the options page.

### Component location

The dialog will live at `src/ui/visual/ConsentPrompt.tsx` (created as a stub
by this ADR; populated by AEG-6-1). It must:

- Be a modal `role="alertdialog"` (the highest-trust dialog role).
- Trap focus inside itself until a decision is made.
- Use `aria-describedby` to point at the three required copy sentences.
- Render no images, no iframes, no `<link rel>` tags.
- Inherit no CSS from the host page (no Shadow DOM is needed because the
  dialog is mounted in extension chrome, not in a content script).

## Consequences

Improves:

- Privacy claim is verifiable — every consent decision (yes OR no) leaves a
  trail.
- The UX is unambiguous: nothing happens until the user reads the action
  sentence and clicks Inspect.
- Future enterprise rollout has a clean policy hook
  (`managed_policy`).

Gets harder:

- One extra click per visual inspection. Acceptable; visual inspection is
  triggered only when the user opts in to it from the popup.

Future implementers must remember:

- Never default-focus the **Inspect** button.
- The dialog is the only consent gate; do not add a "remember my choice"
  checkbox without revisiting this ADR. Persistent consent is what
  ADR-0008 explicitly rejected.

## Alternatives Considered

1. **Single global "Always inspect" toggle.** Rejected by ADR-0008.
2. **Persistent per-domain consent.** Rejected here because phishing
   hostnames are disposable; a per-domain remembered consent has no
   practical value and creates a leak surface.
3. **Inline inline-card consent (no modal).** Rejected because the visual
   inspection contacts a remote origin; the UI must clearly stop the rest
   of the popup until the user responds. A non-modal card can be missed.

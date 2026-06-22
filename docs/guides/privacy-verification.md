# Privacy Verification Guide

## Goal

Prove that Aegis Gorgon's default phishing-analysis flow does not transmit email content or full scanned URLs.

This guide covers both automated tests and the live demo privacy proof.

## What Must Be Proven

Default scan:

- Email body does not leave device.
- Sender and recipient do not leave device.
- Full scanned URL does not go to Aegis-controlled services.
- Full scanned URL does not go to threat-intelligence provider.
- Safe Browsing receives only hash-prefix data.
- ML feature vector stays local.
- LLM prompt stays local or template-only.
- Screenshots are not produced unless visual inspection is requested.
- Telemetry is off.

Optional visual inspection:

- User consent is captured.
- Target-origin request is disclosed in audit log.
- Screenshot stays local.

## Automated Privacy Tests

Test strategy:

- Mock `fetch`.
- Run analysis on a fixture URL inside a fixture email.
- Inspect every outbound request.
- Fail if forbidden data appears in URL, headers, or body.

Forbidden strings:

- Fixture email body text.
- Fixture sender.
- Fixture recipient.
- Full fixture URL.
- Raw prompt containing email text.

Allowed strings:

- Safe Browsing destination hostname.
- Hash prefix.
- Public model asset URL if model download is enabled.
- Local fixture identifiers.

Example assertions:

```ts
expect(networkPayloads).not.toContain(fixture.emailBody);
expect(networkPayloads).not.toContain(fixture.sender);
expect(networkPayloads).not.toContain(fixture.recipient);
expect(networkPayloads).not.toContain(fixture.fullUrl);
expect(networkPayloads).toContain(fixture.expectedHashPrefix);
```

## In-Product Privacy Verifier

The options page should include a "Verify privacy" button.

Flow:

1. Clear local audit log.
2. Load a local fixture email with known links.
3. Run analysis with rules, ML, and Safe Browsing test mode.
4. Generate a template explanation.
5. Display all network calls.
6. Display pass/fail checks.

UI output:

| Check | Expected |
| --- | --- |
| Email content sent | No |
| Sender/recipient sent | No |
| Full URL sent to Aegis | No |
| Full URL sent to threat intelligence | No |
| Hash prefix sent | Yes, if threat intelligence enabled |
| ML features uploaded | No |
| LLM prompt uploaded | No |
| Screenshot uploaded | No |
| Telemetry sent | No unless opt-in |

## Live Demo Privacy Proof

Demo steps:

1. Open DevTools.
2. Open the Network tab.
3. Clear requests.
4. Reload the Gmail fixture or real demo inbox.
5. Let Aegis Gorgon scan links.
6. Show the inline verdicts.
7. Show the network calls.
8. Open the extension options page.
9. Show the privacy audit log.
10. Run the one-click verifier.

Talk track:

- "The extension scanned the links and produced a verdict."
- "The email content is not in the network payloads."
- "The full URL is not sent to threat intelligence."
- "The only external lookup is a hash-prefix request."
- "The audit log records that behavior locally."

## Audit Log Fields

Required:

- Timestamp.
- Destination hostname.
- Purpose.
- Data category.
- Request bytes.
- Response bytes.
- Status.
- Whether user consent was required.
- Whether user consent was present.
- Whether full scanned URL was included.
- Whether email content was included.

The last two fields should be hard-coded false for normal flows and tested.

## Privacy Regression Checklist

Run before every demo:

- `pnpm test:privacy`.
- Manual DevTools inspection.
- One-click verifier.
- Confirm telemetry setting is off.
- Confirm visual inspection setting is off unless demoing the consent flow.
- Confirm `.env.local` is not committed.
- Confirm audit export contains no raw email body.

## Known Privacy Tradeoffs

Safe Browsing:

- Sends hash-prefix data.
- This is privacy-preserving compared with full URL lookup but not the same as zero network activity.

Visual inspection:

- Can contact target origin.
- Must be consent-gated and audited.

Model download:

- May contact model-hosting origin.
- Does not include email content or scanned URLs.

Telemetry:

- Must be opt-in.
- Must be scrubbed.

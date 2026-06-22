import { useEffect, useRef } from "react";
import type { Verdict } from "../../shared/verdict";
import { cn } from "../components/cn";

export interface VisualInspectionConsentRequest {
  /** Display-only URL. Truncated to ≤120 chars before being passed in. */
  urlDisplay: string;
  /** What prompted the request. Shown to the user as additional context. */
  triggeredBy: { verdict: Verdict; topSignal?: string };
}

export type ConsentDecision = "consented" | "declined";

export interface ConsentPromptProps {
  request: VisualInspectionConsentRequest;
  onDecide(decision: ConsentDecision): void;
}

/**
 * Stub implementation of the visual-inspection consent dialog. The full
 * version (focus trap, audit-log integration, offscreen-document handoff)
 * lands with AEG-6-1. The contract is fixed by
 * docs/adrs/0013-visual-inspection-consent-flow.md:
 *
 *   - role="alertdialog"
 *   - Cancel is the default-focused button
 *   - Inspect is the secondary action
 *   - Three required copy lines in order: action, data, privacy
 *   - No images, no iframes, no remote resources
 */
export function ConsentPrompt({ request, onDecide }: ConsentPromptProps) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  // Default-focus the Cancel button per ADR-0013. Auto-focus on the safe
  // option means a user dismissing the dialog with Enter never accidentally
  // consents.
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  // Esc dismisses with "declined".
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDecide("declined");
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDecide]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="aegis-consent-title"
      aria-describedby="aegis-consent-action aegis-consent-data aegis-consent-privacy"
      className={cn(
        "fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/40 p-4",
      )}
    >
      <div className="w-full max-w-md rounded-lg border border-surface-border bg-surface p-4 shadow-xl">
        <h2 id="aegis-consent-title" className="text-base font-semibold">
          Inspect this page?
        </h2>

        <p id="aegis-consent-action" className="mt-2 text-sm text-text-primary">
          Aegis is about to fetch{" "}
          <code className="break-all text-xs">{request.urlDisplay}</code> in an
          isolated frame to compare its appearance against a list of legitimate
          brand logins.
        </p>

        <p id="aegis-consent-data" className="mt-2 text-xs text-text-secondary">
          Fetching this URL contacts the host. The page's owner may see a request
          from your IP. No URL or content leaves your device.
        </p>

        <p id="aegis-consent-privacy" className="mt-1 text-xs text-text-tertiary">
          Your decision is recorded in the local audit log as a
          <code className="mx-1">target_origin_request</code>. You can review it
          on the options page.
        </p>

        <p className="mt-3 text-2xs text-text-tertiary">
          Triggered by: <strong>{request.triggeredBy.verdict}</strong>
          {request.triggeredBy.topSignal ? ` · ${request.triggeredBy.topSignal}` : ""}
        </p>

        <div className="mt-4 flex justify-end gap-2">
          {/*
            Cancel is the default-focused option per ADR-0013. We use a
            native <button> here so the ref propagates without wrapping the
            design-system Button in forwardRef just for the stub.
          */}
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onDecide("declined")}
            className="inline-flex items-center rounded border border-surface-border bg-surface px-3 py-1.5 text-sm text-text-primary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onDecide("consented")}
            className="inline-flex items-center rounded bg-verdict-phishing px-3 py-1.5 text-sm font-medium text-white hover:bg-verdict-phishing/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Inspect this URL
          </button>
        </div>
      </div>
    </div>
  );
}

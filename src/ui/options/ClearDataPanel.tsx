import { useEffect, useState } from "react";
import { Button, Panel } from "../components";
import { sendRequest } from "../../messaging/client";
import { newRequestId } from "../../shared/ids";

type Status = "idle" | "armed" | "clearing" | "cleared" | "error";

const ARMED_TIMEOUT_MS = 5000;

export function ClearDataPanel() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  // After arming, automatically disarm if the user doesn't confirm. This
  // prevents a button left in the "armed" state from firing on accidental
  // later clicks.
  useEffect(() => {
    if (status !== "armed") return;
    const t = setTimeout(() => setStatus("idle"), ARMED_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [status]);

  const onClick = async () => {
    if (status === "idle" || status === "cleared" || status === "error") {
      setStatus("armed");
      setError(null);
      return;
    }
    if (status !== "armed") return;
    setStatus("clearing");
    try {
      const [verdict, audit, training] = await Promise.all([
        sendRequest({ type: "CLEAR_VERDICT_CACHE", requestId: newRequestId() }),
        sendRequest({ type: "CLEAR_AUDIT_LOG", requestId: newRequestId() }),
        sendRequest({ type: "RESET_TRAINING_PROGRESS", requestId: newRequestId() }),
      ]);
      if (verdict.type === "ERROR") throw new Error(verdict.message);
      if (audit.type === "ERROR") throw new Error(audit.message);
      if (training.type === "ERROR") throw new Error(training.message);
      setStatus("cleared");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const label =
    status === "armed"
      ? "Click again to confirm"
      : status === "clearing"
        ? "Clearing…"
        : "Clear local cache, audit log, and training progress";

  return (
    <Panel
      title="Local data"
      description={
        "Wipes the verdict cache, the audit log, and the training progress counters " +
        "on this device. Settings and the prefix DB are preserved. Two clicks required."
      }
    >
      <div className="flex items-center gap-2">
        <Button
          variant="danger"
          size="sm"
          onClick={onClick}
          disabled={status === "clearing"}
          aria-pressed={status === "armed"}
        >
          {label}
        </Button>
        {status === "cleared" && (
          <span className="text-xs text-verdict-safe">Done.</span>
        )}
        {status === "armed" && (
          <span className="text-xs text-verdict-suspicious">
            Are you sure? This cannot be undone.
          </span>
        )}
      </div>
      {error && (
        <div
          role="alert"
          className="mt-2 rounded border border-verdict-phishing/30 bg-verdict-phishing-soft px-2 py-1 text-xs text-verdict-phishing"
        >
          {error}
        </div>
      )}
    </Panel>
  );
}

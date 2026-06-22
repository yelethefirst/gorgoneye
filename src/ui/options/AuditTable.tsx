import { useCallback, useEffect, useState } from "react";
import { sendRequest } from "../../messaging/client";
import { newRequestId } from "../../shared/ids";
import type { AuditRecord } from "../../shared/audit";
import { Badge, Button, Panel } from "../components";

function formatBytes(n?: number): string {
  if (n === undefined) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}

export function AuditTable() {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await sendRequest({
        type: "GET_AUDIT_LOG",
        requestId: newRequestId(),
        limit: 50,
      });
      if (response.type === "ERROR") setError(response.message);
      else setRecords(response.records);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(async () => {
    setError(null);
    try {
      const response = await sendRequest({
        type: "CLEAR_AUDIT_LOG",
        requestId: newRequestId(),
      });
      if (response.type === "ERROR") setError(response.message);
      else await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Panel
      title="Privacy audit log"
      description={
        "Every outbound network call the extension makes is recorded here, with destination, " +
        "purpose, data category, and byte counts. Retained locally for 24 hours."
      }
      className="mt-4"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs text-text-secondary" aria-live="polite">
          {loading ? "Loading…" : `${records.length} record${records.length === 1 ? "" : "s"}`}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={refresh}>
            Refresh
          </Button>
          <Button size="sm" variant="danger" onClick={clear} disabled={records.length === 0}>
            Clear
          </Button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-2 rounded border border-verdict-phishing/30 bg-verdict-phishing-soft px-2 py-1 text-xs text-verdict-phishing"
        >
          {error}
        </div>
      )}

      {records.length === 0 ? (
        <p className="text-xs text-text-tertiary">
          No outbound network calls recorded. This is the expected baseline until you enable
          a layer that talks to a remote service (e.g. Safe Browsing).
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-surface-border text-left text-text-secondary">
                <th className="py-1 pr-2 font-medium">Time</th>
                <th className="py-1 pr-2 font-medium">Destination</th>
                <th className="py-1 pr-2 font-medium">Purpose</th>
                <th className="py-1 pr-2 font-medium">Category</th>
                <th className="py-1 pr-2 font-medium">Req / Resp</th>
                <th className="py-1 pr-2 font-medium">Status</th>
                <th className="py-1 pr-2 font-medium">Full URL?</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-surface-border last:border-0">
                  <td className="py-1 pr-2 tabular-nums">{formatTime(r.timestamp)}</td>
                  <td className="py-1 pr-2">{r.destinationHostname}</td>
                  <td className="py-1 pr-2">{r.purpose}</td>
                  <td className="py-1 pr-2">{r.dataCategory}</td>
                  <td className="py-1 pr-2 tabular-nums">
                    {formatBytes(r.requestBytes)} / {formatBytes(r.responseBytes)}
                  </td>
                  <td className="py-1 pr-2 tabular-nums">{r.status ?? "—"}</td>
                  <td className="py-1 pr-2">
                    {r.containsFullScannedUrl ? (
                      <Badge verdict="suspicious" size="sm">
                        Yes
                      </Badge>
                    ) : (
                      <Badge verdict="safe" size="sm">
                        No
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

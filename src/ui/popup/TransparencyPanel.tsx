import { Panel } from "../components";
import { cn } from "../components/cn";
import type {
  LayerEnabled,
  LayerLastSeen,
  TrafficLight,
  TransparencyState,
} from "./transparencyState";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const LIGHT_DOT: Record<TrafficLight, string> = {
  green: "bg-verdict-safe",
  amber: "bg-verdict-suspicious",
  red: "bg-verdict-phishing",
};

const LIGHT_LABEL: Record<TrafficLight, string> = {
  green: "Nothing left the device",
  amber: "Privacy-preserving call(s)",
  red: "A full URL was sent (consented)",
};

const ENABLED_COPY: Record<LayerEnabled, string> = {
  on: "on",
  off: "off",
  always_on: "always on",
};

const LAST_SEEN_COPY: Record<LayerLastSeen, string> = {
  complete: "complete",
  error: "error",
  unavailable: "unavailable",
  never_run: "never run",
};

const LAST_SEEN_COLOR: Record<LayerLastSeen, string> = {
  complete: "text-verdict-safe",
  error: "text-verdict-phishing",
  unavailable: "text-text-tertiary",
  never_run: "text-text-tertiary",
};

export interface TransparencyPanelProps {
  state: TransparencyState;
  /** Seconds since the snapshot was generated; drives the "Updated Ns ago" label. */
  ageSeconds: number;
}

export function TransparencyPanel({ state, ageSeconds }: TransparencyPanelProps) {
  return (
    <Panel
      title="Live transparency"
      description="Layer status, outbound activity, and whether any data left your device."
    >
      <div className="flex items-center gap-2 text-2xs text-text-tertiary">
        <span aria-hidden="true">●</span>
        <span aria-live="polite">Updated {ageSeconds}s ago</span>
      </div>

      <div className="mt-2 rounded border border-surface-border bg-surface px-2 py-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cn("inline-block size-2 shrink-0 rounded-full", LIGHT_DOT[state.dataLeftDevice])}
          />
          <span className="text-xs font-medium">{LIGHT_LABEL[state.dataLeftDevice]}</span>
        </div>
        <p className="mt-1 text-2xs text-text-secondary">{state.dataLeftDeviceReason}</p>
      </div>

      <dl className="mt-2 grid grid-cols-3 gap-2 text-2xs">
        <Stat label="Calls" value={state.outboundLastHour.count.toString()} />
        <Stat label="Req" value={formatBytes(state.outboundLastHour.requestBytes)} />
        <Stat label="Resp" value={formatBytes(state.outboundLastHour.responseBytes)} />
      </dl>
      {state.outboundLastHour.categories.length > 0 && (
        <p className="mt-1 text-2xs text-text-tertiary">
          Categories: {state.outboundLastHour.categories.join(", ")}
        </p>
      )}

      <h3 className="mt-3 text-2xs font-semibold uppercase tracking-wide text-text-tertiary">
        Layers
      </h3>
      <ul className="mt-1 space-y-0.5 text-2xs">
        {state.activeLayers.map((l) => (
          <li key={l.layer} className="flex items-center justify-between">
            <span className={cn(!l.implemented && "text-text-tertiary")}>{l.label}</span>
            <span className="flex items-center gap-2">
              <span className="text-text-tertiary">{ENABLED_COPY[l.enabled]}</span>
              <span className={cn("tabular-nums", LAST_SEEN_COLOR[l.lastSeen])}>
                {LAST_SEEN_COPY[l.lastSeen]}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded border border-surface-border bg-surface px-1.5 py-1">
      <dt className="uppercase tracking-wide text-text-tertiary">{label}</dt>
      <dd className="mt-0.5 font-semibold text-text-primary">{value}</dd>
    </div>
  );
}

import { Panel, Toggle } from "../components";

export interface TelemetryPanelProps {
  telemetryOptIn: boolean;
  onChange(next: boolean): void;
}

export function TelemetryPanel({ telemetryOptIn, onChange }: TelemetryPanelProps) {
  return (
    <Panel
      title="Telemetry"
      description={
        "Aegis ships no telemetry implementation today. This toggle is the user-facing " +
        "consent flag that future scrubbed-metrics uploads will be gated on. Off by default."
      }
    >
      <Toggle
        checked={telemetryOptIn}
        onChange={onChange}
        label="Allow scrubbed telemetry"
        description="When implemented, will upload aggregate metrics only — never URLs, content, prompts, or feature vectors."
      />
    </Panel>
  );
}

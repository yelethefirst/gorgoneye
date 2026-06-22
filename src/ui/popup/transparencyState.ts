import type { AuditRecord } from "../../shared/audit";
import type { AnalysisResult, LayerId } from "../../shared/verdict";
import type { UserSettings } from "../../storage/settings";

export type LayerEnabled = "on" | "off" | "always_on";
export type LayerLastSeen = "complete" | "error" | "unavailable" | "never_run";

export interface LayerStatus {
  layer: LayerId;
  label: string;
  enabled: LayerEnabled;
  lastSeen: LayerLastSeen;
  implemented: boolean;
}

export type TrafficLight = "green" | "amber" | "red";

export interface OutboundActivity {
  count: number;
  requestBytes: number;
  responseBytes: number;
  categories: string[];
}

export interface TransparencyState {
  activeLayers: LayerStatus[];
  outboundLastHour: OutboundActivity;
  dataLeftDevice: TrafficLight;
  dataLeftDeviceReason: string;
  /** ISO timestamp of when this snapshot was computed. */
  generatedAt: string;
}

const LAYER_DEFS: Array<{
  layer: LayerId;
  label: string;
  settingsKey: keyof UserSettings["layers"] | null;
  implemented: boolean;
  alwaysOn?: boolean;
}> = [
  { layer: "rules", label: "Rules", settingsKey: "rules", implemented: true, alwaysOn: true },
  {
    layer: "threat_intel",
    label: "Threat intel",
    settingsKey: "threatIntel",
    implemented: true,
  },
  { layer: "ml", label: "ML", settingsKey: "ml", implemented: true },
  { layer: "explanation", label: "Explanation", settingsKey: "localLlm", implemented: true },
  { layer: "visual", label: "Visual", settingsKey: "visualInspection", implemented: true },
  { layer: "headers", label: "Headers", settingsKey: "headerAnalysis", implemented: true },
];

function lastSeenFor(layer: LayerId, lastVerdict: AnalysisResult | null): LayerLastSeen {
  if (!lastVerdict) return "never_run";
  const inLayers = (lastVerdict.layers as Record<string, { status?: string }>)[
    layerKeyInResult(layer)
  ];
  if (inLayers && typeof inLayers.status === "string") {
    if (inLayers.status === "complete") return "complete";
    if (inLayers.status === "error") return "error";
    return "unavailable";
  }
  if (lastVerdict.unavailableLayers.some((u) => u.layer === layer)) return "unavailable";
  return "never_run";
}

function layerKeyInResult(layer: LayerId): string {
  // AnalysisResult.layers uses camelCase keys; map them here.
  if (layer === "threat_intel") return "threatIntel";
  return layer;
}

export interface ComputeTransparencyInput {
  settings: UserSettings;
  auditRecords: AuditRecord[];
  lastVerdict: AnalysisResult | null;
  now: number;
  windowMs?: number;
}

export function computeTransparency(input: ComputeTransparencyInput): TransparencyState {
  const windowMs = input.windowMs ?? 60 * 60 * 1000;
  const cutoff = input.now - windowMs;

  const recentRecords = input.auditRecords.filter((r) => {
    const t = Date.parse(r.timestamp);
    return Number.isFinite(t) && t >= cutoff;
  });

  let requestBytes = 0;
  let responseBytes = 0;
  const categories = new Set<string>();
  let sawFullUrl = false;
  let sawTelemetry = false;

  for (const r of recentRecords) {
    requestBytes += r.requestBytes;
    responseBytes += r.responseBytes ?? 0;
    categories.add(r.dataCategory);
    if (r.containsFullScannedUrl) sawFullUrl = true;
    if (r.dataCategory === "scrubbed_telemetry") sawTelemetry = true;
  }

  let dataLeftDevice: TrafficLight = "green";
  let reason = "No outbound calls in the last hour.";
  if (recentRecords.length > 0) {
    dataLeftDevice = "amber";
    reason = `${recentRecords.length} privacy-preserving call(s) in the last hour: ${[...categories].join(", ")}.`;
  }
  if (sawFullUrl) {
    dataLeftDevice = "red";
    reason = "A consented call carried a full URL (target-origin visual inspection).";
  } else if (sawTelemetry) {
    // Telemetry is opt-in but still warrants a stronger signal than the default amber.
    dataLeftDevice = "amber";
    reason = "Opt-in scrubbed telemetry was uploaded; no URL or content shared.";
  }

  const activeLayers: LayerStatus[] = LAYER_DEFS.map((def) => {
    const enabledRaw = def.settingsKey ? input.settings.layers[def.settingsKey] : false;
    const enabled: LayerEnabled = def.alwaysOn ? "always_on" : enabledRaw ? "on" : "off";
    return {
      layer: def.layer,
      label: def.label,
      enabled,
      lastSeen: lastSeenFor(def.layer, input.lastVerdict),
      implemented: def.implemented,
    };
  });

  return {
    activeLayers,
    outboundLastHour: {
      count: recentRecords.length,
      requestBytes,
      responseBytes,
      categories: [...categories],
    },
    dataLeftDevice,
    dataLeftDeviceReason: reason,
    generatedAt: new Date(input.now).toISOString(),
  };
}

import { Panel, Toggle } from "../components";
import type { UserSettings } from "../../storage/settings";

type LayerKey = keyof UserSettings["layers"];

interface LayerSpec {
  key: LayerKey;
  label: string;
  description: string;
  implemented: boolean;
}

const LAYERS: LayerSpec[] = [
  {
    key: "rules",
    label: "Rule-based URL analysis",
    description: "Local, deterministic. The backbone of every verdict.",
    implemented: true,
  },
  {
    key: "threatIntel",
    label: "Safe Browsing hash-prefix lookup",
    description:
      "Privacy-preserving threat-intel via 4-byte hash prefixes. Off by default; opt in here.",
    implemented: true,
  },
  {
    key: "ml",
    label: "Local ML classifier",
    description: "On-device ONNX model. Off by default; opt in here.",
    implemented: true,
  },
  {
    key: "localLlm",
    label: "Local LLM explanations",
    description:
      "Optional WebLLM explanation path. Loads the model only when you request an explanation.",
    implemented: true,
  },
  {
    key: "visualInspection",
    label: "Visual brand inspection",
    description:
      "Compares a page's appearance against legitimate-brand logos using a local perceptual hash. Each inspection requires explicit per-URL consent.",
    implemented: true,
  },
  {
    key: "headerAnalysis",
    label: "Email header analysis",
    description:
      "Reads SPF, DKIM, and DMARC when Gmail's 'Show original' view is open. Missing headers report 'not available'; we never default a missing mechanism to pass.",
    implemented: true,
  },
];

export interface LayerTogglesPanelProps {
  settings: UserSettings;
  onChange(key: LayerKey, next: boolean): void;
}

export function LayerTogglesPanel({ settings, onChange }: LayerTogglesPanelProps) {
  return (
    <Panel
      title="Detection layers"
      description="Each layer can be toggled independently. Rules is always on while protection is enabled."
    >
      <div className="space-y-3">
        {LAYERS.map(({ key, label, description, implemented }) => (
          <Toggle
            key={key}
            checked={settings.layers[key]}
            onChange={(next) => onChange(key, next)}
            label={label}
            description={implemented ? description : `${description} (Not yet implemented.)`}
            disabled={!implemented || key === "rules"}
          />
        ))}
      </div>
    </Panel>
  );
}

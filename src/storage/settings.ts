import type { KvStore } from "./kvStore";

export interface UserSettings {
  enabled: boolean;
  layers: {
    rules: boolean;
    ml: boolean;
    threatIntel: boolean;
    localLlm: boolean;
    visualInspection: boolean;
    headerAnalysis: boolean;
  };
  telemetryOptIn: boolean;
  visualInspectionConsentMode: "never" | "ask_each_time" | "managed_policy";
  trustedDomains: string[];
  cacheTtlHours: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  enabled: true,
  layers: {
    rules: true,
    ml: false,
    threatIntel: false,
    localLlm: false,
    visualInspection: false,
    headerAnalysis: false,
  },
  telemetryOptIn: false,
  visualInspectionConsentMode: "never",
  trustedDomains: [],
  cacheTtlHours: 24,
};

const SETTINGS_KEY = "settings";

export class SettingsStore {
  constructor(private readonly kv: KvStore) {}

  async get(): Promise<UserSettings> {
    const stored = await this.kv.get<UserSettings>(SETTINGS_KEY);
    return mergeWithDefaults(stored);
  }

  async update(patch: Partial<UserSettings>): Promise<UserSettings> {
    const current = await this.get();
    const next: UserSettings = {
      ...current,
      ...patch,
      layers: { ...current.layers, ...(patch.layers ?? {}) },
    };
    await this.kv.set(SETTINGS_KEY, next);
    return next;
  }

  async reset(): Promise<UserSettings> {
    await this.kv.set(SETTINGS_KEY, DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }
}

function mergeWithDefaults(stored: UserSettings | undefined): UserSettings {
  if (!stored) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    layers: { ...DEFAULT_SETTINGS.layers, ...stored.layers },
  };
}

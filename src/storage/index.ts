import { createChromeKvStore, createMemoryKvStore, type KvStore } from "./kvStore";
import { SettingsStore } from "./settings";
import { VerdictCache } from "./verdictCache";
import { AuditStore } from "../audit/auditStore";
import { PrefixDb } from "../threat-intel/prefixDb";
import { TrainingProgressStore } from "./trainingStore";

export { SettingsStore, type UserSettings, DEFAULT_SETTINGS } from "./settings";
export { VerdictCache, type VerdictCacheEntry } from "./verdictCache";
export { createMemoryKvStore, createChromeKvStore, type KvStore } from "./kvStore";
export { AuditStore } from "../audit/auditStore";
export { PrefixDb } from "../threat-intel/prefixDb";
export { TrainingProgressStore } from "./trainingStore";

let cachedSettings: SettingsStore | null = null;
let cachedVerdicts: VerdictCache | null = null;
let cachedAudit: AuditStore | null = null;
let cachedPrefixDb: PrefixDb | null = null;
let cachedTraining: TrainingProgressStore | null = null;

function chromeStorageLocal(namespace: string): KvStore {
  const area = chrome?.storage?.local;
  if (!area) return createMemoryKvStore();
  return createChromeKvStore(area, namespace);
}

export function getSettingsStore(): SettingsStore {
  if (!cachedSettings) cachedSettings = new SettingsStore(chromeStorageLocal("aegis"));
  return cachedSettings;
}

export function getVerdictCache(): VerdictCache {
  if (!cachedVerdicts) cachedVerdicts = new VerdictCache(chromeStorageLocal("aegis"));
  return cachedVerdicts;
}

export function getAuditStore(): AuditStore {
  if (!cachedAudit) cachedAudit = new AuditStore(chromeStorageLocal("aegis-audit"));
  return cachedAudit;
}

export function getPrefixDb(): PrefixDb {
  if (!cachedPrefixDb) cachedPrefixDb = new PrefixDb(chromeStorageLocal("aegis-prefix-db"));
  return cachedPrefixDb;
}

export function getTrainingStore(): TrainingProgressStore {
  if (!cachedTraining) cachedTraining = new TrainingProgressStore(chromeStorageLocal("aegis-training"));
  return cachedTraining;
}

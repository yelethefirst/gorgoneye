import type { KvStore } from "../storage/kvStore";

export type ThreatType = "MALWARE" | "SOCIAL_ENGINEERING" | "UNWANTED_SOFTWARE";

/** A prefix → threat-types association in the local hash-prefix database. */
export interface PrefixEntry {
  /** Hex-encoded prefix (any length supported; defaults to 4 bytes / 8 hex chars). */
  prefixHex: string;
  threatTypes: ThreatType[];
  /** ISO timestamp; useful for staleness checks once the update API is wired up. */
  updatedAt: string;
}

const DB_KEY = "prefix-db";

interface StoredDb {
  prefixes: Record<string, { threatTypes: ThreatType[]; updatedAt: string }>;
}

/**
 * Local hash-prefix database. Real-world deployments populate this via the
 * Safe Browsing v4 Update API (out of scope for this ticket); for now we
 * expose `seed()` so tests and demo fixtures can prime known prefixes.
 */
export class PrefixDb {
  private inMemory: Map<string, { threatTypes: ThreatType[]; updatedAt: string }> = new Map();
  private hydrated = false;

  constructor(private readonly kv?: KvStore) {}

  async load(): Promise<void> {
    if (this.hydrated) return;
    if (!this.kv) {
      this.hydrated = true;
      return;
    }
    const stored = await this.kv.get<StoredDb>(DB_KEY);
    if (stored) {
      this.inMemory = new Map(Object.entries(stored.prefixes));
    }
    this.hydrated = true;
  }

  async seed(entries: PrefixEntry[]): Promise<void> {
    await this.load();
    for (const e of entries) {
      this.inMemory.set(e.prefixHex.toLowerCase(), {
        threatTypes: e.threatTypes,
        updatedAt: e.updatedAt,
      });
    }
    await this.persist();
  }

  async hasPrefix(prefixHex: string): Promise<boolean> {
    await this.load();
    return this.inMemory.has(prefixHex.toLowerCase());
  }

  async lookup(prefixHex: string): Promise<PrefixEntry | undefined> {
    await this.load();
    const got = this.inMemory.get(prefixHex.toLowerCase());
    if (!got) return undefined;
    return { prefixHex: prefixHex.toLowerCase(), ...got };
  }

  async size(): Promise<number> {
    await this.load();
    return this.inMemory.size;
  }

  async clear(): Promise<void> {
    this.inMemory.clear();
    await this.persist();
  }

  private async persist(): Promise<void> {
    if (!this.kv) return;
    const prefixes: StoredDb["prefixes"] = {};
    for (const [key, value] of this.inMemory.entries()) {
      prefixes[key] = value;
    }
    await this.kv.set(DB_KEY, { prefixes } satisfies StoredDb);
  }
}

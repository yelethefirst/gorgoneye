import type { AnalysisResult } from "../shared/verdict";
import type { KvStore } from "./kvStore";

export interface VerdictCacheEntry {
  urlHash: string;
  canonicalUrlDisplay: string;
  result: AnalysisResult;
  createdAt: string;
  expiresAt: string;
  detectionVersion: string;
}

interface CacheIndex {
  hashes: string[];
}

const INDEX_KEY = "index";
const ENTRY_PREFIX = "entry::";
const DETECTION_VERSION = "stub-0.0.1";

function entryKey(urlHash: string): string {
  return `${ENTRY_PREFIX}${urlHash}`;
}

export interface ClockLike {
  now(): number;
}

export const systemClock: ClockLike = { now: () => Date.now() };

export class VerdictCache {
  private readonly maxRecent: number;

  constructor(
    private readonly kv: KvStore,
    private readonly clock: ClockLike = systemClock,
    options: { maxRecent?: number } = {},
  ) {
    this.maxRecent = options.maxRecent ?? 50;
  }

  async put(
    result: AnalysisResult,
    options: { canonicalUrlDisplay?: string; ttlMs?: number } = {},
  ): Promise<VerdictCacheEntry> {
    const now = this.clock.now();
    const ttlMs = options.ttlMs ?? 24 * 60 * 60 * 1000;
    const entry: VerdictCacheEntry = {
      urlHash: result.urlHash,
      canonicalUrlDisplay: options.canonicalUrlDisplay ?? result.urlDisplay,
      result,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
      detectionVersion: DETECTION_VERSION,
    };

    await this.kv.set(entryKey(result.urlHash), entry);
    await this.indexPush(result.urlHash);
    return entry;
  }

  async get(urlHash: string): Promise<VerdictCacheEntry | undefined> {
    const entry = await this.kv.get<VerdictCacheEntry>(entryKey(urlHash));
    if (!entry) return undefined;
    if (this.isExpired(entry)) {
      await this.delete(urlHash);
      return undefined;
    }
    return entry;
  }

  async delete(urlHash: string): Promise<void> {
    await this.kv.delete(entryKey(urlHash));
    const index = await this.loadIndex();
    const filtered = index.hashes.filter((h) => h !== urlHash);
    await this.saveIndex({ hashes: filtered });
  }

  async recent(limit = 10): Promise<VerdictCacheEntry[]> {
    const index = await this.loadIndex();
    const recentHashes = [...index.hashes].reverse().slice(0, limit);
    const entries = await Promise.all(recentHashes.map((h) => this.get(h)));
    return entries.filter((entry): entry is VerdictCacheEntry => Boolean(entry));
  }

  async clear(): Promise<void> {
    const index = await this.loadIndex();
    await Promise.all(index.hashes.map((h) => this.kv.delete(entryKey(h))));
    await this.kv.delete(INDEX_KEY);
  }

  async purgeExpired(): Promise<number> {
    const index = await this.loadIndex();
    let removed = 0;
    const surviving: string[] = [];
    for (const hash of index.hashes) {
      const entry = await this.kv.get<VerdictCacheEntry>(entryKey(hash));
      if (!entry) {
        removed += 1;
        continue;
      }
      if (this.isExpired(entry)) {
        await this.kv.delete(entryKey(hash));
        removed += 1;
      } else {
        surviving.push(hash);
      }
    }
    await this.saveIndex({ hashes: surviving });
    return removed;
  }

  private isExpired(entry: VerdictCacheEntry): boolean {
    return new Date(entry.expiresAt).getTime() <= this.clock.now();
  }

  private async loadIndex(): Promise<CacheIndex> {
    return (await this.kv.get<CacheIndex>(INDEX_KEY)) ?? { hashes: [] };
  }

  private async saveIndex(index: CacheIndex): Promise<void> {
    await this.kv.set(INDEX_KEY, index);
  }

  private async indexPush(urlHash: string): Promise<void> {
    const index = await this.loadIndex();
    const deduped = index.hashes.filter((h) => h !== urlHash);
    deduped.push(urlHash);
    while (deduped.length > this.maxRecent) {
      const evicted = deduped.shift();
      if (evicted) await this.kv.delete(entryKey(evicted));
    }
    await this.saveIndex({ hashes: deduped });
  }
}

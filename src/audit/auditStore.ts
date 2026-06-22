import type { AuditRecord } from "../shared/audit";
import type { KvStore } from "../storage/kvStore";
import type { ClockLike } from "../storage/verdictCache";
import { systemClock } from "../storage/verdictCache";

const INDEX_KEY = "index";
const RECORD_PREFIX = "record::";

interface AuditIndex {
  ids: string[];
}

interface StoredRecord {
  record: AuditRecord;
  expiresAt: number;
}

function recordKey(id: string): string {
  return `${RECORD_PREFIX}${id}`;
}

export interface AuditStoreOptions {
  ttlMs?: number;
  /** Cap on retained records; oldest are evicted when exceeded. Default 500. */
  maxRecords?: number;
}

export class AuditStore {
  private readonly ttlMs: number;
  private readonly maxRecords: number;

  constructor(
    private readonly kv: KvStore,
    private readonly clock: ClockLike = systemClock,
    opts: AuditStoreOptions = {},
  ) {
    this.ttlMs = opts.ttlMs ?? 24 * 60 * 60 * 1000;
    this.maxRecords = opts.maxRecords ?? 500;
  }

  async put(record: AuditRecord): Promise<void> {
    const expiresAt = this.clock.now() + this.ttlMs;
    await this.kv.set(recordKey(record.id), { record, expiresAt } satisfies StoredRecord);
    await this.indexPush(record.id);
  }

  async get(id: string): Promise<AuditRecord | undefined> {
    const stored = await this.kv.get<StoredRecord>(recordKey(id));
    if (!stored) return undefined;
    if (stored.expiresAt <= this.clock.now()) {
      await this.delete(id);
      return undefined;
    }
    return stored.record;
  }

  async delete(id: string): Promise<void> {
    await this.kv.delete(recordKey(id));
    const index = await this.loadIndex();
    await this.saveIndex({ ids: index.ids.filter((existing) => existing !== id) });
  }

  async recent(limit = 50): Promise<AuditRecord[]> {
    const index = await this.loadIndex();
    const ids = [...index.ids].reverse().slice(0, limit);
    const out: AuditRecord[] = [];
    for (const id of ids) {
      const record = await this.get(id);
      if (record) out.push(record);
    }
    return out;
  }

  async clear(): Promise<void> {
    const index = await this.loadIndex();
    await Promise.all(index.ids.map((id) => this.kv.delete(recordKey(id))));
    await this.kv.delete(INDEX_KEY);
  }

  async purgeExpired(): Promise<number> {
    const index = await this.loadIndex();
    const now = this.clock.now();
    let removed = 0;
    const surviving: string[] = [];
    for (const id of index.ids) {
      const stored = await this.kv.get<StoredRecord>(recordKey(id));
      if (!stored) {
        removed += 1;
        continue;
      }
      if (stored.expiresAt <= now) {
        await this.kv.delete(recordKey(id));
        removed += 1;
      } else {
        surviving.push(id);
      }
    }
    await this.saveIndex({ ids: surviving });
    return removed;
  }

  private async loadIndex(): Promise<AuditIndex> {
    return (await this.kv.get<AuditIndex>(INDEX_KEY)) ?? { ids: [] };
  }

  private async saveIndex(index: AuditIndex): Promise<void> {
    await this.kv.set(INDEX_KEY, index);
  }

  private async indexPush(id: string): Promise<void> {
    const index = await this.loadIndex();
    const deduped = index.ids.filter((existing) => existing !== id);
    deduped.push(id);
    while (deduped.length > this.maxRecords) {
      const evicted = deduped.shift();
      if (evicted) await this.kv.delete(recordKey(evicted));
    }
    await this.saveIndex({ ids: deduped });
  }
}

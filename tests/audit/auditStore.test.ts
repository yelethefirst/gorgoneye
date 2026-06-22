import { describe, expect, it } from "vitest";
import { createMemoryKvStore } from "../../src/storage/kvStore";
import { AuditStore } from "../../src/audit/auditStore";
import type { AuditRecord } from "../../src/shared/audit";

function record(id: string, t: string): AuditRecord {
  return {
    id,
    timestamp: t,
    destinationHostname: "safebrowsing.example",
    method: "POST",
    purpose: "safe_browsing_update",
    dataCategory: "hash_prefix",
    requestBytes: 64,
    responseBytes: 128,
    status: 200,
    containsEmailContent: false,
    containsFullScannedUrl: false,
    userConsented: false,
  };
}

function makeClock(start: number) {
  let now = start;
  return {
    now: () => now,
    advance(ms: number) {
      now += ms;
    },
  };
}

describe("AuditStore", () => {
  it("stores and retrieves a record", async () => {
    const store = new AuditStore(createMemoryKvStore());
    const r = record("a", "2026-05-26T00:00:00.000Z");
    await store.put(r);
    await expect(store.get("a")).resolves.toEqual(r);
  });

  it("returns recent records in most-recent-first order", async () => {
    const store = new AuditStore(createMemoryKvStore());
    await store.put(record("a", "t1"));
    await store.put(record("b", "t2"));
    await store.put(record("c", "t3"));
    const recent = await store.recent();
    expect(recent.map((r) => r.id)).toEqual(["c", "b", "a"]);
  });

  it("expires records past TTL", async () => {
    const clock = makeClock(1_000_000);
    const store = new AuditStore(createMemoryKvStore(), clock, { ttlMs: 1_000 });
    await store.put(record("x", "t"));
    clock.advance(2_000);
    await expect(store.get("x")).resolves.toBeUndefined();
  });

  it("purgeExpired drops stale entries and reports the count removed", async () => {
    const clock = makeClock(1_000_000);
    const store = new AuditStore(createMemoryKvStore(), clock, { ttlMs: 1_000 });
    await store.put(record("a", "t1"));
    await store.put(record("b", "t2"));
    clock.advance(2_000);
    await store.put(record("c", "t3"));
    const removed = await store.purgeExpired();
    expect(removed).toBe(2);
    const recent = await store.recent();
    expect(recent.map((r) => r.id)).toEqual(["c"]);
  });

  it("clear wipes everything", async () => {
    const store = new AuditStore(createMemoryKvStore());
    await store.put(record("a", "t1"));
    await store.put(record("b", "t2"));
    await store.clear();
    await expect(store.recent()).resolves.toEqual([]);
  });

  it("respects the maxRecords cap by evicting the oldest", async () => {
    const store = new AuditStore(createMemoryKvStore(), undefined, { maxRecords: 2 });
    await store.put(record("a", "t1"));
    await store.put(record("b", "t2"));
    await store.put(record("c", "t3"));
    const recent = await store.recent();
    expect(recent.map((r) => r.id)).toEqual(["c", "b"]);
    await expect(store.get("a")).resolves.toBeUndefined();
  });
});

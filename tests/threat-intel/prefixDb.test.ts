import { describe, expect, it } from "vitest";
import { createMemoryKvStore } from "../../src/storage/kvStore";
import { PrefixDb } from "../../src/threat-intel/prefixDb";

describe("PrefixDb", () => {
  it("returns false for unseeded prefixes", async () => {
    const db = new PrefixDb();
    await expect(db.hasPrefix("deadbeef")).resolves.toBe(false);
  });

  it("seed makes a prefix queryable", async () => {
    const db = new PrefixDb();
    await db.seed([
      {
        prefixHex: "deadbeef",
        threatTypes: ["SOCIAL_ENGINEERING"],
        updatedAt: "2026-05-26T00:00:00.000Z",
      },
    ]);
    await expect(db.hasPrefix("deadbeef")).resolves.toBe(true);
    const entry = await db.lookup("DEADBEEF");
    expect(entry?.threatTypes).toEqual(["SOCIAL_ENGINEERING"]);
  });

  it("normalizes lookup case", async () => {
    const db = new PrefixDb();
    await db.seed([
      { prefixHex: "ABcd1234", threatTypes: ["MALWARE"], updatedAt: "now" },
    ]);
    await expect(db.hasPrefix("abcd1234")).resolves.toBe(true);
    await expect(db.hasPrefix("ABCD1234")).resolves.toBe(true);
  });

  it("persists to the KvStore and reloads", async () => {
    const kv = createMemoryKvStore();
    const db1 = new PrefixDb(kv);
    await db1.seed([{ prefixHex: "feedface", threatTypes: ["MALWARE"], updatedAt: "t" }]);

    const db2 = new PrefixDb(kv);
    await expect(db2.hasPrefix("feedface")).resolves.toBe(true);
  });

  it("clear empties the database", async () => {
    const db = new PrefixDb();
    await db.seed([{ prefixHex: "deadbeef", threatTypes: ["MALWARE"], updatedAt: "t" }]);
    await db.clear();
    await expect(db.hasPrefix("deadbeef")).resolves.toBe(false);
    await expect(db.size()).resolves.toBe(0);
  });
});

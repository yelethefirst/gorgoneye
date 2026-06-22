import { describe, expect, it } from "vitest";
import { AuditStore } from "../../src/audit/auditStore";
import { createMemoryKvStore } from "../../src/storage/kvStore";
import { canonicalizeForSafeBrowsing } from "../../src/threat-intel/canonicalize";
import { enumerateUrlExpressions } from "../../src/threat-intel/expressions";
import { hashWithPrefix } from "../../src/threat-intel/hash";
import { PrefixDb } from "../../src/threat-intel/prefixDb";
import { SafeBrowsingClient } from "../../src/threat-intel/safeBrowsing";

const SCANNED_URL = "https://malicious.example/payload?q=1";

async function knownPrefix(url: string): Promise<{ prefixHex: string; hashHex: string }> {
  const canonical = canonicalizeForSafeBrowsing(url);
  if (!canonical) throw new Error("canonicalize failed");
  const exps = enumerateUrlExpressions(canonical);
  return hashWithPrefix(exps[0]!);
}

function hexToBase64(hex: string): string {
  let bin = "";
  for (let i = 0; i < hex.length; i += 2) {
    bin += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  }
  return btoa(bin);
}

describe("SafeBrowsingClient.lookup", () => {
  it("returns matched=false when no local prefix matches and makes NO network call", async () => {
    const audit = new AuditStore(createMemoryKvStore());
    const client = new SafeBrowsingClient(new PrefixDb(), audit);
    const result = await client.lookup(SCANNED_URL);
    expect(result.matched).toBe(false);
    expect(result.status).toBe("complete");
    expect(result.hashPrefixSent).toBeNull();
    await expect(audit.recent()).resolves.toEqual([]);
  });

  it("returns matched=true on a confirmed full-hash match (testMode response)", async () => {
    const audit = new AuditStore(createMemoryKvStore());
    const db = new PrefixDb();
    const { prefixHex, hashHex } = await knownPrefix(SCANNED_URL);
    await db.seed([
      { prefixHex, threatTypes: ["SOCIAL_ENGINEERING"], updatedAt: "t" },
    ]);

    const client = new SafeBrowsingClient(db, audit, {
      testFullHashResponse: {
        matches: [{ threatType: "SOCIAL_ENGINEERING", threat: { hash: hexToBase64(hashHex) } }],
      },
    });

    const result = await client.lookup(SCANNED_URL);
    expect(result.matched).toBe(true);
    expect(result.threatTypes).toEqual(["SOCIAL_ENGINEERING"]);
    expect(result.hashPrefixSent).toContain(prefixHex);
  });

  it("returns matched=false when the API returns no matching full hash", async () => {
    const audit = new AuditStore(createMemoryKvStore());
    const db = new PrefixDb();
    const { prefixHex } = await knownPrefix(SCANNED_URL);
    await db.seed([{ prefixHex, threatTypes: ["MALWARE"], updatedAt: "t" }]);

    const client = new SafeBrowsingClient(db, audit, {
      testFullHashResponse: { matches: [] },
    });
    const result = await client.lookup(SCANNED_URL);
    expect(result.matched).toBe(false);
    expect(result.status).toBe("complete");
    expect(result.hashPrefixSent).toContain(prefixHex);
  });

  it("records an audit entry that does NOT contain the full scanned URL", async () => {
    const audit = new AuditStore(createMemoryKvStore());
    const db = new PrefixDb();
    const { prefixHex } = await knownPrefix(SCANNED_URL);
    await db.seed([{ prefixHex, threatTypes: ["MALWARE"], updatedAt: "t" }]);

    const client = new SafeBrowsingClient(db, audit, {
      testFullHashResponse: { matches: [] },
    });
    await client.lookup(SCANNED_URL);

    const records = await audit.recent();
    expect(records).toHaveLength(1);
    const r = records[0]!;
    expect(r.purpose).toBe("safe_browsing_full_hash");
    expect(r.dataCategory).toBe("hash_prefix");
    expect(r.destinationHostname).toBe("safebrowsing.googleapis.com");
    expect(r.containsFullScannedUrl).toBe(false);
    expect(r.containsEmailContent).toBe(false);
  });

  it("returns unavailable when the network throws", async () => {
    const audit = new AuditStore(createMemoryKvStore());
    const db = new PrefixDb();
    const { prefixHex } = await knownPrefix(SCANNED_URL);
    await db.seed([{ prefixHex, threatTypes: ["MALWARE"], updatedAt: "t" }]);

    const client = new SafeBrowsingClient(db, audit, {
      fetchImpl: async () => {
        throw new Error("network down");
      },
    });
    const result = await client.lookup(SCANNED_URL);
    expect(result.status).toBe("unavailable");
    expect(result.matched).toBe(false);
    expect(result.error).toMatch(/network down/);
  });

  it("returns an error result when canonicalization fails", async () => {
    const audit = new AuditStore(createMemoryKvStore());
    const client = new SafeBrowsingClient(new PrefixDb(), audit);
    const result = await client.lookup("javascript:alert(1)");
    expect(result.status).toBe("error");
    expect(result.matched).toBe(false);
    expect(result.error).toMatch(/canonicalization/i);
  });

  it("returns status='error' on a non-2xx HTTP response", async () => {
    const audit = new AuditStore(createMemoryKvStore());
    const db = new PrefixDb();
    const { prefixHex } = await knownPrefix(SCANNED_URL);
    await db.seed([{ prefixHex, threatTypes: ["MALWARE"], updatedAt: "t" }]);

    const client = new SafeBrowsingClient(db, audit, {
      fetchImpl: async () =>
        new Response("rate limited", {
          status: 429,
          headers: { "content-type": "text/plain" },
        }),
    });
    const result = await client.lookup(SCANNED_URL);
    expect(result.status).toBe("error");
    expect(result.matched).toBe(false);
    expect(result.error).toMatch(/HTTP 429/);
  });

  it("returns status='error' when the response body is not JSON", async () => {
    const audit = new AuditStore(createMemoryKvStore());
    const db = new PrefixDb();
    const { prefixHex } = await knownPrefix(SCANNED_URL);
    await db.seed([{ prefixHex, threatTypes: ["MALWARE"], updatedAt: "t" }]);

    const client = new SafeBrowsingClient(db, audit, {
      fetchImpl: async () =>
        new Response("not json at all", {
          status: 200,
          headers: { "content-type": "text/plain" },
        }),
    });
    const result = await client.lookup(SCANNED_URL);
    expect(result.status).toBe("error");
    expect(result.error).toMatch(/parse_failed/i);
  });

  it("ignores threat-intel response hashes that don't match a locally computed hash", async () => {
    const audit = new AuditStore(createMemoryKvStore());
    const db = new PrefixDb();
    const { prefixHex } = await knownPrefix(SCANNED_URL);
    await db.seed([{ prefixHex, threatTypes: ["MALWARE"], updatedAt: "t" }]);

    // Server returns a "match" for a fabricated full hash we never asked about.
    const client = new SafeBrowsingClient(db, audit, {
      testFullHashResponse: {
        matches: [
          { threatType: "MALWARE", threat: { hash: hexToBase64("00".repeat(32)) } },
        ],
      },
    });
    const result = await client.lookup(SCANNED_URL);
    expect(result.matched).toBe(false);
    expect(result.threatTypes).toEqual([]);
  });
});

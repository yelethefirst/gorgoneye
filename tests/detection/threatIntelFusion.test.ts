import { describe, expect, it } from "vitest";
import { analyzeUrl } from "../../src/detection/analyzeUrl";
import { AuditStore } from "../../src/audit/auditStore";
import { createMemoryKvStore } from "../../src/storage/kvStore";
import {
  canonicalizeForSafeBrowsing,
} from "../../src/threat-intel/canonicalize";
import { enumerateUrlExpressions } from "../../src/threat-intel/expressions";
import { hashWithPrefix } from "../../src/threat-intel/hash";
import { PrefixDb } from "../../src/threat-intel/prefixDb";
import { SafeBrowsingClient } from "../../src/threat-intel/safeBrowsing";

async function knownPrefix(url: string) {
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

const URL_BENIGN = "https://github.com/aegishield/gorgon-eye";
const URL_FOR_TI = "https://example.com/login";

describe("analyzeUrl + threat-intel fusion (AEG-5-4)", () => {
  it("without a client: threat_intel is in unavailableLayers and layers.threatIntel is undefined", async () => {
    const result = await analyzeUrl({
      url: URL_BENIGN,
      context: { surface: "test_fixture", userGesture: "manual_scan" },
    });
    expect(result.layers.threatIntel).toBeUndefined();
    const reasons = result.unavailableLayers
      .filter((u) => u.layer === "threat_intel")
      .map((u) => u.reason);
    expect(reasons.length).toBeGreaterThan(0);
    expect(reasons[0]).toMatch(/Safe Browsing/i);
  });

  it("with an empty prefix DB: threatIntel layer runs, matched=false, no full-hash call recorded", async () => {
    const audit = new AuditStore(createMemoryKvStore());
    const client = new SafeBrowsingClient(new PrefixDb(), audit);

    const result = await analyzeUrl({
      url: URL_FOR_TI,
      context: { surface: "test_fixture", userGesture: "manual_scan" },
      threatIntel: client,
    });
    expect(result.layers.threatIntel?.status).toBe("complete");
    expect(result.layers.threatIntel?.matched).toBe(false);
    expect(result.layers.threatIntel?.provider).toBe("google_safe_browsing");
    expect(result.layers.threatIntel?.lookupMode).toBe("hash_prefix");
    expect(result.privacy.hashPrefixSentToThreatIntel).toBe(false);
    await expect(audit.recent()).resolves.toEqual([]);
  });

  it("confirmed match elevates verdict to phishing", async () => {
    const audit = new AuditStore(createMemoryKvStore());
    const db = new PrefixDb();
    const { prefixHex, hashHex } = await knownPrefix(URL_FOR_TI);
    await db.seed([
      { prefixHex, threatTypes: ["SOCIAL_ENGINEERING"], updatedAt: "t" },
    ]);
    const client = new SafeBrowsingClient(db, audit, {
      testFullHashResponse: {
        matches: [{ threatType: "SOCIAL_ENGINEERING", threat: { hash: hexToBase64(hashHex) } }],
      },
    });

    const result = await analyzeUrl({
      url: URL_FOR_TI,
      context: { surface: "test_fixture", userGesture: "manual_scan" },
      threatIntel: client,
    });
    expect(result.layers.threatIntel?.matched).toBe(true);
    expect(result.verdict).toBe("phishing");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.privacy.hashPrefixSentToThreatIntel).toBe(true);
    // A fired signal for the threat-intel match is surfaced for the UI.
    const tiSignal = result.firedSignals.find((s) => s.layer === "threat_intel");
    expect(tiSignal).toBeDefined();
    expect(tiSignal!.severity).toBe("critical");
  });

  it("unmatched threat-intel does not double-count rule-fired signals", async () => {
    const audit = new AuditStore(createMemoryKvStore());
    const client = new SafeBrowsingClient(new PrefixDb(), audit);

    const benign = await analyzeUrl({
      url: URL_BENIGN,
      context: { surface: "test_fixture", userGesture: "manual_scan" },
    });
    const benignWithTi = await analyzeUrl({
      url: URL_BENIGN,
      context: { surface: "test_fixture", userGesture: "manual_scan" },
      threatIntel: client,
    });
    expect(benignWithTi.confidence).toBeCloseTo(benign.confidence, 4);
    expect(benignWithTi.verdict).toBe(benign.verdict);
  });
});

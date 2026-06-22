import { describe, expect, it } from "vitest";
import { computeTransparency } from "../../../src/ui/popup/transparencyState";
import { DEFAULT_SETTINGS } from "../../../src/storage/settings";
import type { AuditRecord } from "../../../src/shared/audit";
import { analyzeUrl } from "../../../src/detection/analyzeUrl";

const NOW = Date.parse("2026-05-27T12:00:00.000Z");

function record(over: Partial<AuditRecord> = {}): AuditRecord {
  return {
    id: "id",
    timestamp: new Date(NOW - 5 * 60 * 1000).toISOString(),
    destinationHostname: "safebrowsing.googleapis.com",
    method: "POST",
    purpose: "safe_browsing_full_hash",
    dataCategory: "hash_prefix",
    requestBytes: 256,
    responseBytes: 1024,
    status: 200,
    containsEmailContent: false,
    containsFullScannedUrl: false,
    userConsented: false,
    ...over,
  };
}

describe("computeTransparency", () => {
  it("green light + zero outbound when there are no audit records", () => {
    const state = computeTransparency({
      settings: DEFAULT_SETTINGS,
      auditRecords: [],
      lastVerdict: null,
      now: NOW,
    });
    expect(state.dataLeftDevice).toBe("green");
    expect(state.outboundLastHour.count).toBe(0);
    expect(state.outboundLastHour.requestBytes).toBe(0);
    expect(state.outboundLastHour.categories).toEqual([]);
  });

  it("amber light + non-zero counts when a hash-prefix call happened in the window", () => {
    const state = computeTransparency({
      settings: DEFAULT_SETTINGS,
      auditRecords: [record({ id: "r1" }), record({ id: "r2" })],
      lastVerdict: null,
      now: NOW,
    });
    expect(state.dataLeftDevice).toBe("amber");
    expect(state.outboundLastHour.count).toBe(2);
    expect(state.outboundLastHour.requestBytes).toBe(512);
    expect(state.outboundLastHour.responseBytes).toBe(2048);
    expect(state.outboundLastHour.categories).toEqual(["hash_prefix"]);
  });

  it("red light when a record carries a full scanned URL (consented inspection)", () => {
    const state = computeTransparency({
      settings: DEFAULT_SETTINGS,
      auditRecords: [
        record({
          id: "visual",
          purpose: "visual_inspection_target_origin",
          dataCategory: "target_origin_request",
          containsFullScannedUrl: true,
          userConsented: true,
          destinationHostname: "target.example",
        }),
      ],
      lastVerdict: null,
      now: NOW,
    });
    expect(state.dataLeftDevice).toBe("red");
    expect(state.dataLeftDeviceReason).toMatch(/full URL/i);
  });

  it("excludes records older than the configured window", () => {
    const old = record({
      id: "ancient",
      timestamp: new Date(NOW - 2 * 60 * 60 * 1000).toISOString(),
    });
    const fresh = record({ id: "fresh" });
    const state = computeTransparency({
      settings: DEFAULT_SETTINGS,
      auditRecords: [old, fresh],
      lastVerdict: null,
      now: NOW,
    });
    expect(state.outboundLastHour.count).toBe(1);
  });

  it("supports a custom window", () => {
    const a = record({
      id: "a",
      timestamp: new Date(NOW - 10 * 60 * 1000).toISOString(),
    });
    const state = computeTransparency({
      settings: DEFAULT_SETTINGS,
      auditRecords: [a],
      lastVerdict: null,
      now: NOW,
      windowMs: 5 * 60 * 1000,
    });
    expect(state.outboundLastHour.count).toBe(0);
  });

  it("layer status reflects settings (rules always_on, threatIntel respects flag)", () => {
    const state = computeTransparency({
      settings: { ...DEFAULT_SETTINGS, layers: { ...DEFAULT_SETTINGS.layers, threatIntel: true } },
      auditRecords: [],
      lastVerdict: null,
      now: NOW,
    });
    const rules = state.activeLayers.find((l) => l.layer === "rules")!;
    const ti = state.activeLayers.find((l) => l.layer === "threat_intel")!;
    expect(rules.enabled).toBe("always_on");
    expect(ti.enabled).toBe("on");
    const ml = state.activeLayers.find((l) => l.layer === "ml")!;
    expect(ml.enabled).toBe("off");
    expect(ml.implemented).toBe(true);
  });

  it("layer lastSeen reflects the most recent verdict's layer status", async () => {
    const lastVerdict = await analyzeUrl({
      url: "https://github.com/aegishield",
      context: { surface: "test_fixture", userGesture: "manual_scan" },
    });
    const state = computeTransparency({
      settings: DEFAULT_SETTINGS,
      auditRecords: [],
      lastVerdict,
      now: NOW,
    });
    const rules = state.activeLayers.find((l) => l.layer === "rules")!;
    const ml = state.activeLayers.find((l) => l.layer === "ml")!;
    expect(rules.lastSeen).toBe("complete");
    expect(ml.lastSeen).toBe("unavailable");
  });
});

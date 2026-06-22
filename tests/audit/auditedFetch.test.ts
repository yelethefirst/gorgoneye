import { describe, expect, it, vi } from "vitest";
import { AuditStore } from "../../src/audit/auditStore";
import { auditedFetch } from "../../src/audit/auditedFetch";
import { createMemoryKvStore } from "../../src/storage/kvStore";

function makeStore() {
  return new AuditStore(createMemoryKvStore());
}

describe("auditedFetch — body-policy enforcement", () => {
  it("rejects a body that looks like a URL when containsFullScannedUrl is not set", async () => {
    const store = makeStore();
    await expect(
      auditedFetch(
        {
          url: "https://api.example.com/echo",
          method: "POST",
          body: "scanned=https://victim.example/path",
          purpose: "telemetry_opt_in",
          dataCategory: "scrubbed_telemetry",
        },
        { store },
      ),
    ).rejects.toThrow(/contain a URL/);
    await expect(store.recent()).resolves.toEqual([]);
  });

  it("rejects containsFullScannedUrl=true outside target_origin_request", async () => {
    const store = makeStore();
    await expect(
      auditedFetch(
        {
          url: "https://api.example.com/echo",
          method: "POST",
          body: "https://victim.example/",
          purpose: "telemetry_opt_in",
          dataCategory: "scrubbed_telemetry",
          containsFullScannedUrl: true,
          userConsented: true,
        },
        { store },
      ),
    ).rejects.toThrow(/target_origin_request/);
  });

  it("rejects containsFullScannedUrl=true without userConsented", async () => {
    const store = makeStore();
    await expect(
      auditedFetch(
        {
          url: "https://target.example/",
          method: "GET",
          purpose: "visual_inspection_target_origin",
          dataCategory: "target_origin_request",
          containsFullScannedUrl: true,
        },
        { store },
      ),
    ).rejects.toThrow(/user consent/);
  });

  it("allows a consented target-origin call that carries the URL", async () => {
    const store = makeStore();
    const result = await auditedFetch(
      {
        url: "https://target.example/login",
        method: "GET",
        purpose: "visual_inspection_target_origin",
        dataCategory: "target_origin_request",
        containsFullScannedUrl: true,
        userConsented: true,
        testMode: { status: 200, body: "<html/>" },
      },
      { store },
    );
    expect(result.status).toBe(200);
    const recent = await store.recent();
    expect(recent).toHaveLength(1);
    expect(recent[0]!.containsFullScannedUrl).toBe(true);
    expect(recent[0]!.userConsented).toBe(true);
  });
});

describe("auditedFetch — test mode and recording", () => {
  it("records destination, purpose, byte counts, and status in test mode", async () => {
    const store = makeStore();
    const out = await auditedFetch(
      {
        url: "https://safebrowsing.example/v4/threatMatches:find?key=K",
        method: "POST",
        body: "prefix=deadbeef",
        purpose: "safe_browsing_full_hash",
        dataCategory: "hash_prefix",
        testMode: { status: 200, body: "{}" },
      },
      { store },
    );
    expect(out.recordId).toMatch(/^audit_/);
    const recent = await store.recent();
    expect(recent).toHaveLength(1);
    const r = recent[0]!;
    expect(r.destinationHostname).toBe("safebrowsing.example");
    expect(r.method).toBe("POST");
    expect(r.purpose).toBe("safe_browsing_full_hash");
    expect(r.dataCategory).toBe("hash_prefix");
    expect(r.status).toBe(200);
    expect(r.requestBytes).toBeGreaterThan(0);
    expect(r.responseBytes).toBe(2); // "{}" is 2 bytes
    expect(r.containsEmailContent).toBe(false);
    expect(r.containsFullScannedUrl).toBe(false);
  });

  it("does not call the network in test mode", async () => {
    const store = makeStore();
    const fetchSpy = vi.fn();
    await auditedFetch(
      {
        url: "https://example.com/",
        method: "GET",
        purpose: "demo_fixture",
        dataCategory: "fixture",
        testMode: { status: 204, body: "" },
      },
      { store, fetchImpl: fetchSpy as never },
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("invokes the supplied fetchImpl when not in test mode", async () => {
    const store = makeStore();
    const fetchImpl = vi.fn(async () =>
      new Response("hello", { status: 200, headers: { "content-type": "text/plain" } }),
    );
    const out = await auditedFetch(
      {
        url: "https://example.com/",
        method: "GET",
        purpose: "demo_fixture",
        dataCategory: "fixture",
      },
      { store, fetchImpl: fetchImpl as never },
    );
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(out.status).toBe(200);
    expect(out.bodyText).toBe("hello");
  });

  it("records a failed fetch and re-throws with the audit id attached", async () => {
    const store = makeStore();
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    });
    let caught: unknown;
    try {
      await auditedFetch(
        {
          url: "https://example.com/",
          method: "GET",
          purpose: "demo_fixture",
          dataCategory: "fixture",
        },
        { store, fetchImpl: fetchImpl as never },
      );
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error & { auditRecordId?: string }).auditRecordId).toMatch(/^audit_/);
    const recent = await store.recent();
    expect(recent).toHaveLength(1);
    expect(recent[0]!.status).toBeUndefined();
  });
});

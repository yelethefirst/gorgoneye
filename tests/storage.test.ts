import { describe, expect, it } from "vitest";
import { createMemoryKvStore } from "../src/storage/kvStore";
import { SettingsStore, DEFAULT_SETTINGS } from "../src/storage/settings";
import { VerdictCache, type ClockLike } from "../src/storage/verdictCache";
import { analyzeUrl } from "../src/detection/analyzeUrl";

describe("SettingsStore", () => {
  it("returns defaults when nothing is stored", async () => {
    const store = new SettingsStore(createMemoryKvStore());
    await expect(store.get()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it("merges partial updates without losing nested layer flags", async () => {
    const store = new SettingsStore(createMemoryKvStore());
    const next = await store.update({ layers: { rules: false } as never });
    expect(next.layers.rules).toBe(false);
    expect(next.layers.ml).toBe(DEFAULT_SETTINGS.layers.ml);
    expect(next.enabled).toBe(DEFAULT_SETTINGS.enabled);
  });

  it("reset restores defaults", async () => {
    const store = new SettingsStore(createMemoryKvStore());
    await store.update({ enabled: false });
    await expect(store.reset()).resolves.toEqual(DEFAULT_SETTINGS);
  });
});

describe("VerdictCache", () => {
  function makeClock(start: number): ClockLike & { advance(ms: number): void } {
    let now = start;
    return {
      now: () => now,
      advance: (ms: number) => {
        now += ms;
      },
    };
  }

  it("stores and retrieves a verdict", async () => {
    const cache = new VerdictCache(createMemoryKvStore());
    const result = await analyzeUrl({
      url: "https://example.com",
      context: { surface: "test_fixture", userGesture: "manual_scan" },
    });
    await cache.put(result);
    const entry = await cache.get(result.urlHash);
    expect(entry?.result.urlHash).toBe(result.urlHash);
  });

  it("expires entries past the TTL", async () => {
    const clock = makeClock(1_000_000);
    const cache = new VerdictCache(createMemoryKvStore(), clock);
    const result = await analyzeUrl({
      url: "https://example.com/login",
      context: { surface: "test_fixture", userGesture: "manual_scan" },
    });
    await cache.put(result, { ttlMs: 1_000 });

    clock.advance(2_000);
    await expect(cache.get(result.urlHash)).resolves.toBeUndefined();
  });

  it("returns recent verdicts in most-recent-first order", async () => {
    const cache = new VerdictCache(createMemoryKvStore());
    const first = await analyzeUrl({
      url: "https://example.com/a",
      context: { surface: "test_fixture", userGesture: "manual_scan" },
    });
    const second = await analyzeUrl({
      url: "https://example.com/b/login",
      context: { surface: "test_fixture", userGesture: "manual_scan" },
    });
    await cache.put(first);
    await cache.put(second);
    const recent = await cache.recent(5);
    expect(recent[0]?.urlHash).toBe(second.urlHash);
    expect(recent[1]?.urlHash).toBe(first.urlHash);
  });
});

describe("analyzeUrl (storage integration)", () => {
  it("preserves privacy flags on every result", async () => {
    const result = await analyzeUrl({
      url: "https://random-site.example/account/verify",
      context: { surface: "test_fixture", userGesture: "manual_scan" },
    });
    expect(result.privacy.emailContentLeftDevice).toBe(false);
    expect(result.privacy.fullUrlSentToThreatIntel).toBe(false);
    expect(result.privacy.targetOriginContacted).toBe(false);
    expect(result.privacy.telemetrySent).toBe(false);
  });
});

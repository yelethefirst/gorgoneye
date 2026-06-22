export interface PerfStats {
  sampleCount: number;
  mean: number;
  p50: number;
  p90: number;
  p95: number;
  max: number;
}

/**
 * Computes percentile statistics from a sample array. Empty input throws so
 * callers can't silently pass a passing budget check on no data.
 *
 * Percentiles use the "nearest rank" method (P95 = the value at ceil(0.95*N) − 1
 * in the sorted array), which is robust and easy to reason about across tests.
 */
export function computeStats(samples: number[]): PerfStats {
  if (samples.length === 0) {
    throw new Error("computeStats: samples must be non-empty");
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);

  function percentile(p: number): number {
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
    return sorted[idx]!;
  }

  return {
    sampleCount: sorted.length,
    mean: sum / sorted.length,
    p50: percentile(0.5),
    p90: percentile(0.9),
    p95: percentile(0.95),
    max: sorted[sorted.length - 1]!,
  };
}

function highResNow(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

/**
 * Runs `fn(item)` once per item, returns the durations array and the stats.
 * Adds a warm-up pass (first item run once and discarded) so JIT compilation
 * doesn't bias the P95 of the first item.
 */
export async function measureAsync<T>(
  items: readonly T[],
  fn: (item: T) => Promise<unknown>,
): Promise<{ durations: number[]; stats: PerfStats }> {
  if (items.length === 0) {
    throw new Error("measureAsync: items must be non-empty");
  }
  // Warm-up
  await fn(items[0]!);

  const durations: number[] = new Array(items.length);
  for (let i = 0; i < items.length; i += 1) {
    const start = highResNow();
    await fn(items[i]!);
    durations[i] = highResNow() - start;
  }
  return { durations, stats: computeStats(durations) };
}

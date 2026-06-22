import { describe, expect, it } from "vitest";
import { createMemoryKvStore } from "../../src/storage/kvStore";
import { TrainingProgressStore } from "../../src/storage/trainingStore";
import { ZERO_TRAINING_PROGRESS } from "../../src/shared/training";

const FIXED_NOW = () => "2026-06-01T00:00:00.000Z";

describe("TrainingProgressStore", () => {
  it("returns zeros for a fresh store", async () => {
    const store = new TrainingProgressStore(createMemoryKvStore(), FIXED_NOW);
    await expect(store.get()).resolves.toEqual(ZERO_TRAINING_PROGRESS);
  });

  it("recordThreatSeen increments only the threats counter", async () => {
    const store = new TrainingProgressStore(createMemoryKvStore(), FIXED_NOW);
    const after = await store.recordThreatSeen();
    expect(after.threatsSeen).toBe(1);
    expect(after.trainingsAttempted).toBe(0);
    expect(after.trainingsCompleted).toBe(0);
    expect(after.currentStreak).toBe(0);
    expect(after.updatedAt).toBe(FIXED_NOW());
  });

  it("recordAnswer(true) increments attempts, completed, and streak", async () => {
    const store = new TrainingProgressStore(createMemoryKvStore(), FIXED_NOW);
    const a = await store.recordAnswer(true);
    expect(a.trainingsAttempted).toBe(1);
    expect(a.trainingsCompleted).toBe(1);
    expect(a.currentStreak).toBe(1);
    expect(a.bestStreak).toBe(1);
    const b = await store.recordAnswer(true);
    expect(b.currentStreak).toBe(2);
    expect(b.bestStreak).toBe(2);
  });

  it("recordAnswer(false) resets the current streak but increments attempts", async () => {
    const store = new TrainingProgressStore(createMemoryKvStore(), FIXED_NOW);
    await store.recordAnswer(true);
    await store.recordAnswer(true);
    const after = await store.recordAnswer(false);
    expect(after.currentStreak).toBe(0);
    expect(after.bestStreak).toBe(2);
    expect(after.trainingsAttempted).toBe(3);
    expect(after.trainingsCompleted).toBe(2);
  });

  it("bestStreak is monotonic non-decreasing across resets-via-wrong-answer", async () => {
    const store = new TrainingProgressStore(createMemoryKvStore(), FIXED_NOW);
    for (const correct of [true, true, true, false, true, true]) {
      await store.recordAnswer(correct);
    }
    const final = await store.get();
    expect(final.bestStreak).toBe(3);
    expect(final.currentStreak).toBe(2);
  });

  it("reset wipes counters back to zero with a fresh timestamp", async () => {
    const store = new TrainingProgressStore(createMemoryKvStore(), FIXED_NOW);
    await store.recordThreatSeen();
    await store.recordAnswer(true);
    const after = await store.reset();
    expect(after.threatsSeen).toBe(0);
    expect(after.trainingsAttempted).toBe(0);
    expect(after.trainingsCompleted).toBe(0);
    expect(after.currentStreak).toBe(0);
    expect(after.bestStreak).toBe(0);
    expect(after.updatedAt).toBe(FIXED_NOW());
  });

  it("persists across instances backed by the same KvStore", async () => {
    const kv = createMemoryKvStore();
    const a = new TrainingProgressStore(kv, FIXED_NOW);
    await a.recordThreatSeen();
    await a.recordAnswer(true);

    const b = new TrainingProgressStore(kv, FIXED_NOW);
    const reloaded = await b.get();
    expect(reloaded.threatsSeen).toBe(1);
    expect(reloaded.trainingsAttempted).toBe(1);
    expect(reloaded.currentStreak).toBe(1);
  });
});

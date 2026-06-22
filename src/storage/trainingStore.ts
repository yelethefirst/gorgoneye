import type { KvStore } from "./kvStore";
import { ZERO_TRAINING_PROGRESS, type TrainingProgress } from "../shared/training";

const KEY = "training-progress";

export interface NowFn {
  (): string;
}

const isoNow: NowFn = () => new Date().toISOString();

/**
 * Persists training progress (threats seen, attempts, completions, streak).
 *
 * Stored locally; never uploaded. The store is namespaced under
 * `aegis-training` in `chrome.storage.local` so it doesn't collide with
 * verdict cache or settings.
 */
export class TrainingProgressStore {
  constructor(
    private readonly kv: KvStore,
    private readonly now: NowFn = isoNow,
  ) {}

  async get(): Promise<TrainingProgress> {
    const stored = await this.kv.get<TrainingProgress>(KEY);
    if (!stored) return { ...ZERO_TRAINING_PROGRESS };
    return { ...ZERO_TRAINING_PROGRESS, ...stored };
  }

  async recordThreatSeen(): Promise<TrainingProgress> {
    const current = await this.get();
    const next: TrainingProgress = {
      ...current,
      threatsSeen: current.threatsSeen + 1,
      updatedAt: this.now(),
    };
    await this.kv.set(KEY, next);
    return next;
  }

  async recordAnswer(correct: boolean): Promise<TrainingProgress> {
    const current = await this.get();
    const currentStreak = correct ? current.currentStreak + 1 : 0;
    const next: TrainingProgress = {
      ...current,
      trainingsAttempted: current.trainingsAttempted + 1,
      trainingsCompleted: current.trainingsCompleted + (correct ? 1 : 0),
      currentStreak,
      bestStreak: Math.max(current.bestStreak, currentStreak),
      updatedAt: this.now(),
    };
    await this.kv.set(KEY, next);
    return next;
  }

  async reset(): Promise<TrainingProgress> {
    const next: TrainingProgress = {
      ...ZERO_TRAINING_PROGRESS,
      updatedAt: this.now(),
    };
    await this.kv.set(KEY, next);
    return next;
  }
}

export interface TrainingProgress {
  /** Cumulative count of phishing verdicts the user has been shown. */
  threatsSeen: number;
  /** Cumulative count of training-card attempts (any answer click). */
  trainingsAttempted: number;
  /** Cumulative count of training-card attempts answered correctly. */
  trainingsCompleted: number;
  /** Current streak of consecutive correct answers. Resets on any wrong answer. */
  currentStreak: number;
  /** All-time best streak. */
  bestStreak: number;
  /** ISO timestamp of the last update; useful for staleness in the UI. */
  updatedAt: string;
}

export const ZERO_TRAINING_PROGRESS: TrainingProgress = {
  threatsSeen: 0,
  trainingsAttempted: 0,
  trainingsCompleted: 0,
  currentStreak: 0,
  bestStreak: 0,
  updatedAt: new Date(0).toISOString(),
};

import { Panel } from "../components";
import type { TrainingProgress } from "../../shared/training";

export interface TrainingStatsPanelProps {
  progress: TrainingProgress;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center rounded border border-surface-border bg-surface px-2 py-1.5 text-center">
      <dt className="text-2xs uppercase tracking-wide text-text-tertiary">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold text-text-primary">{value}</dd>
    </div>
  );
}

export function TrainingStatsPanel({ progress }: TrainingStatsPanelProps) {
  const accuracy =
    progress.trainingsAttempted === 0
      ? "—"
      : `${Math.round((progress.trainingsCompleted / progress.trainingsAttempted) * 100)}%`;
  return (
    <Panel
      title="Training progress"
      description="All numbers are stored on this device only. Nothing is uploaded."
    >
      <dl className="grid grid-cols-4 gap-2">
        <Stat label="Threats" value={progress.threatsSeen} />
        <Stat label="Correct" value={progress.trainingsCompleted} />
        <Stat label="Streak" value={progress.currentStreak} />
        <Stat label="Accuracy" value={accuracy} />
      </dl>
      {progress.bestStreak > progress.currentStreak && (
        <p className="mt-2 text-2xs text-text-tertiary">
          Best streak so far: {progress.bestStreak}.
        </p>
      )}
    </Panel>
  );
}

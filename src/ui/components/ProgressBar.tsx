import type { Verdict } from "../../shared/verdict";
import { cn } from "./cn";

export interface ProgressBarProps {
  /** Value in [0, 1]. Values outside the range are clamped. */
  value: number;
  verdict?: Verdict;
  label?: string;
  className?: string;
}

const VERDICT_FILL: Record<Verdict, string> = {
  safe: "bg-verdict-safe",
  suspicious: "bg-verdict-suspicious",
  phishing: "bg-verdict-phishing",
  unknown: "bg-verdict-unknown",
};

export function ProgressBar({ value, verdict = "unknown", label, className }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const pct = Math.round(clamped * 100);

  return (
    <div
      role="progressbar"
      aria-label={label ?? "Confidence"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-surface-muted",
        className,
      )}
    >
      <div
        className={cn("h-full rounded-full transition-[width]", VERDICT_FILL[verdict])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

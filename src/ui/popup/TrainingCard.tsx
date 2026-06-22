import { useState } from "react";
import { Button, Panel } from "../components";
import { cn } from "../components/cn";
import type { TrainingCard as TrainingCardData, TrainingOption } from "./buildTrainingCard";

export interface TrainingCardProps {
  card: TrainingCardData;
  onDismiss(): void;
  /** Called once when the user clicks an option, with the correctness flag. */
  onAnswer?(correct: boolean): void;
}

/**
 * Non-modal micro-training card. Shown only after a phishing verdict. The user
 * can dismiss instantly without picking an answer, and dismissing is the only
 * required action — no progress is tracked unless the user opts in by clicking
 * an option, in which case `onAnswer(correct)` fires exactly once.
 */
export function TrainingCard({ card, onDismiss, onAnswer }: TrainingCardProps) {
  const [picked, setPicked] = useState<TrainingOption | null>(null);

  const pick = (option: TrainingOption) => {
    if (picked) return;
    setPicked(option);
    onAnswer?.(option.correct);
  };

  return (
    <Panel
      title="Quick check"
      description={card.giveaway}
      className="mt-3 border-verdict-phishing/40"
    >
      <p className="text-sm font-medium">{card.question}</p>

      <ul className="mt-2 space-y-1.5" role="radiogroup" aria-label="Training answer choices">
        {card.options.map((option, idx) => {
          const isPicked = picked === option;
          const showState = picked !== null;
          return (
            <li key={idx}>
              <button
                type="button"
                role="radio"
                aria-checked={isPicked}
                disabled={picked !== null && !isPicked && !option.correct}
                onClick={() => pick(option)}
                className={cn(
                  "w-full rounded border px-2 py-1.5 text-left text-xs transition-colors",
                  !showState && "border-surface-border bg-surface hover:bg-surface-muted",
                  showState && option.correct && "border-verdict-safe/60 bg-verdict-safe-soft",
                  showState &&
                    isPicked &&
                    !option.correct &&
                    "border-verdict-phishing/60 bg-verdict-phishing-soft",
                  showState &&
                    !isPicked &&
                    !option.correct &&
                    "border-surface-border bg-surface text-text-tertiary",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
                )}
              >
                {option.label}
              </button>
            </li>
          );
        })}
      </ul>

      {picked && (
        <div
          role="status"
          className={cn(
            "mt-2 rounded border px-2 py-1.5 text-2xs",
            picked.correct
              ? "border-verdict-safe/40 bg-verdict-safe-soft text-verdict-safe"
              : "border-verdict-suspicious/40 bg-verdict-suspicious-soft text-verdict-suspicious",
          )}
        >
          {picked.correct ? "Correct. " : "Not quite. "}
          {card.explanation}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </Panel>
  );
}

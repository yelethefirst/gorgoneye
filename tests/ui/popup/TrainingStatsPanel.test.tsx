import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TrainingStatsPanel } from "../../../src/ui/popup/TrainingStatsPanel";
import { ZERO_TRAINING_PROGRESS } from "../../../src/shared/training";

describe("TrainingStatsPanel (render smoke)", () => {
  it("shows the four-stat grid with em-dash accuracy when there are no attempts", () => {
    const html = renderToStaticMarkup(
      <TrainingStatsPanel progress={ZERO_TRAINING_PROGRESS} />,
    );
    expect(html).toContain("Training progress");
    expect(html).toContain(">Threats<");
    expect(html).toContain(">Correct<");
    expect(html).toContain(">Streak<");
    expect(html).toContain(">Accuracy<");
    expect(html).toMatch(/>—</); // em-dash accuracy
  });

  it("shows accuracy as a percent when attempts exist", () => {
    const html = renderToStaticMarkup(
      <TrainingStatsPanel
        progress={{
          ...ZERO_TRAINING_PROGRESS,
          trainingsAttempted: 4,
          trainingsCompleted: 3,
          currentStreak: 1,
          bestStreak: 2,
        }}
      />,
    );
    expect(html).toContain(">75%<");
    expect(html).toContain("Best streak so far: 2");
  });

  it("does not show the 'best streak' line when current === best", () => {
    const html = renderToStaticMarkup(
      <TrainingStatsPanel
        progress={{
          ...ZERO_TRAINING_PROGRESS,
          trainingsAttempted: 2,
          trainingsCompleted: 2,
          currentStreak: 2,
          bestStreak: 2,
        }}
      />,
    );
    expect(html).not.toContain("Best streak so far");
  });

  it("includes the local-only disclaimer in the panel description", () => {
    const html = renderToStaticMarkup(
      <TrainingStatsPanel progress={ZERO_TRAINING_PROGRESS} />,
    );
    expect(html).toContain("stored on this device only");
  });
});

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TrainingCard } from "../../../src/ui/popup/TrainingCard";
import type { TrainingCard as TrainingCardData } from "../../../src/ui/popup/buildTrainingCard";

const SAMPLE: TrainingCardData = {
  giveaway: "The domain looks like PayPal, but it isn't.",
  question: "Why is this URL dangerous if it advertises PayPal?",
  options: [
    {
      label: "The domain is a typo away from paypal.com — it's impersonating the brand.",
      correct: true,
    },
    { label: "PayPal doesn't run a website at all.", correct: false },
    { label: "The page is secure because it uses HTTPS.", correct: false },
  ],
  explanation:
    "Typosquatting works by swapping a letter for a lookalike. Always check the registrable domain.",
  sourceRuleId: "typosquatting",
};

describe("TrainingCard (render smoke)", () => {
  it("renders the giveaway, question, and every option", () => {
    const html = renderToStaticMarkup(
      <TrainingCard card={SAMPLE} onDismiss={() => {}} />,
    );
    // react-dom escapes apostrophes; compare on the safe substring.
    expect(html).toContain("Quick check");
    expect(html).toContain("The domain looks like PayPal");
    expect(html).toContain("Why is this URL dangerous");
    expect(html).toContain("a typo away from paypal.com");
    expect(html).toContain("doesn");
    expect(html).toContain("page is secure because it uses HTTPS");
  });

  it("exposes each option as a role=radio button inside a radiogroup", () => {
    const html = renderToStaticMarkup(
      <TrainingCard card={SAMPLE} onDismiss={() => {}} />,
    );
    expect(html).toContain('role="radiogroup"');
    const radios = html.match(/role="radio"/g) ?? [];
    expect(radios.length).toBe(SAMPLE.options.length);
  });

  it("renders a Dismiss button so the user can leave at any time", () => {
    const html = renderToStaticMarkup(
      <TrainingCard card={SAMPLE} onDismiss={() => {}} />,
    );
    expect(html).toMatch(/>\s*Dismiss\s*</);
  });
});

export type StepId = "intro" | "privacy" | "pin" | "ready" | "done";

export const STEP_ORDER: readonly StepId[] = ["intro", "privacy", "pin", "ready"];

export function stepIndex(step: StepId): number {
  return STEP_ORDER.indexOf(step);
}

export function nextStep(current: StepId): StepId {
  if (current === "done") return "done";
  const i = STEP_ORDER.indexOf(current);
  if (i < 0 || i === STEP_ORDER.length - 1) return "done";
  return STEP_ORDER[i + 1]!;
}

export function prevStep(current: StepId): StepId {
  if (current === "done") return STEP_ORDER[STEP_ORDER.length - 1]!;
  const i = STEP_ORDER.indexOf(current);
  if (i <= 0) return current;
  return STEP_ORDER[i - 1]!;
}

export function isLastStep(current: StepId): boolean {
  return current === STEP_ORDER[STEP_ORDER.length - 1];
}

export function isDone(current: StepId): boolean {
  return current === "done";
}

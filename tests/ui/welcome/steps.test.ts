import { describe, expect, it } from "vitest";
import {
  isDone,
  isLastStep,
  nextStep,
  prevStep,
  stepIndex,
  STEP_ORDER,
} from "../../../src/ui/welcome/steps";

describe("welcome steps", () => {
  it("STEP_ORDER has four entries in the expected order", () => {
    expect(STEP_ORDER).toEqual(["intro", "privacy", "pin", "ready"]);
  });

  it("nextStep walks forward through each step then lands on done", () => {
    expect(nextStep("intro")).toBe("privacy");
    expect(nextStep("privacy")).toBe("pin");
    expect(nextStep("pin")).toBe("ready");
    expect(nextStep("ready")).toBe("done");
    expect(nextStep("done")).toBe("done");
  });

  it("prevStep walks backward and stops at intro", () => {
    expect(prevStep("ready")).toBe("pin");
    expect(prevStep("pin")).toBe("privacy");
    expect(prevStep("privacy")).toBe("intro");
    expect(prevStep("intro")).toBe("intro");
    expect(prevStep("done")).toBe("ready");
  });

  it("stepIndex returns -1 for the done state", () => {
    expect(stepIndex("intro")).toBe(0);
    expect(stepIndex("ready")).toBe(3);
    expect(stepIndex("done")).toBe(-1);
  });

  it("isLastStep only returns true on the final ordered step", () => {
    expect(isLastStep("ready")).toBe(true);
    expect(isLastStep("intro")).toBe(false);
    expect(isLastStep("done")).toBe(false);
  });

  it("isDone returns true only for the done sentinel", () => {
    expect(isDone("done")).toBe(true);
    expect(isDone("intro")).toBe(false);
  });
});

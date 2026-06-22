import { describe, expect, it } from "vitest";
import {
  isExtensionRequest,
  isExtensionResponse,
  makeErrorResponse,
  type AnalyzeUrlRequest,
} from "../src/shared/messages";

describe("message contract guards", () => {
  it("recognizes a valid ANALYZE_URL request", () => {
    const request: AnalyzeUrlRequest = {
      type: "ANALYZE_URL",
      requestId: "req_abc",
      url: "https://example.com/login",
      context: { surface: "generic_page", userGesture: "hover" },
    };
    expect(isExtensionRequest(request)).toBe(true);
  });

  it("rejects requests with unknown type", () => {
    expect(isExtensionRequest({ type: "DELETE_ALL_DATA", requestId: "req_x" })).toBe(false);
  });

  it("recognizes GET_SETTINGS and UPDATE_SETTINGS", () => {
    expect(isExtensionRequest({ type: "GET_SETTINGS", requestId: "req_s" })).toBe(true);
    expect(
      isExtensionRequest({
        type: "UPDATE_SETTINGS",
        requestId: "req_u",
        patch: { enabled: false },
      }),
    ).toBe(true);
  });

  it("recognizes the three training-progress requests", () => {
    expect(isExtensionRequest({ type: "GET_TRAINING_PROGRESS", requestId: "g" })).toBe(true);
    expect(
      isExtensionRequest({
        type: "RECORD_TRAINING_ANSWER",
        requestId: "r",
        correct: true,
      }),
    ).toBe(true);
    expect(isExtensionRequest({ type: "RESET_TRAINING_PROGRESS", requestId: "z" })).toBe(true);
  });

  it("recognizes explanation and cancellation requests", () => {
    expect(
      isExtensionRequest({
        type: "EXPLAIN_VERDICT",
        requestId: "explain",
        analysisId: "analysis_1",
        mode: "local_llm",
      }),
    ).toBe(true);
    expect(
      isExtensionRequest({
        type: "CANCEL_EXPLAIN_VERDICT",
        requestId: "cancel",
        targetRequestId: "explain",
      }),
    ).toBe(true);
  });

  it("rejects requests missing a requestId", () => {
    expect(isExtensionRequest({ type: "ANALYZE_URL", url: "https://example.com" })).toBe(false);
  });

  it("recognizes valid response shapes", () => {
    const err = makeErrorResponse("req_abc", "INVALID_PAYLOAD", "boom");
    expect(isExtensionResponse(err)).toBe(true);
    expect(
      isExtensionResponse({
        type: "EXPLAIN_VERDICT_PROGRESS",
        requestId: "req_abc",
        phase: "loading",
        message: "Loading",
        progress: 0.5,
      }),
    ).toBe(true);
    expect(err).toMatchObject({
      type: "ERROR",
      requestId: "req_abc",
      code: "INVALID_PAYLOAD",
    });
  });
});

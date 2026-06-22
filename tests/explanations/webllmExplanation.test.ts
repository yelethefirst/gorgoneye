import { describe, expect, it } from "vitest";
import { analyzeUrl } from "../../src/detection/analyzeUrl";
import {
  buildWebLlmExplanation,
  buildWebLlmExplanationWithFallback,
  type WebLlmEngineLike,
} from "../../src/explanations/webllmExplanation";

const FIXED_NOW = () => "2026-05-26T00:00:00.000Z";

async function fixtureResult() {
  return analyzeUrl({
    url: "http://paypal.com@192.168.0.1/login?next=http://evil.tk/steal",
    context: { surface: "test_fixture", userGesture: "manual_scan" },
  });
}

function streamingEngine(chunks: string[]): WebLlmEngineLike {
  return {
    chat: {
      completions: {
        async create() {
          return {
            async *[Symbol.asyncIterator]() {
              for (const chunk of chunks) {
                yield { choices: [{ delta: { content: chunk } }] };
              }
            },
          };
        },
      },
    },
  };
}

describe("buildWebLlmExplanation", () => {
  it("collects streamed JSON and returns a local_llm explanation", async () => {
    const tokens: string[] = [];
    const result = await fixtureResult();

    const explanation = await buildWebLlmExplanation(result, {
      now: FIXED_NOW,
      engine: streamingEngine([
        '{"text":"This link shows embedded credentials and a risky redirect.',
        ' Do not sign in here.","guidance":["Close the tab","Open PayPal directly"]}',
      ]),
      onToken: (text) => tokens.push(text),
    });

    expect(explanation.mode).toBe("local_llm");
    expect(explanation.generatedAt).toBe(FIXED_NOW());
    expect(explanation.text).toContain("embedded credentials");
    expect(explanation.guidance).toEqual(["Close the tab", "Open PayPal directly"]);
    expect(tokens.join("")).toContain("Do not sign in");
  });

  it("falls back to template output when the engine fails", async () => {
    const result = await fixtureResult();
    const explanation = await buildWebLlmExplanationWithFallback(result, {
      now: FIXED_NOW,
      engine: {
        chat: {
          completions: {
            async create() {
              throw new Error("WebGPU unavailable");
            },
          },
        },
      },
    });

    expect(explanation.mode).toBe("template");
    expect(explanation.text).toMatch(/Strong evidence/i);
  });
});

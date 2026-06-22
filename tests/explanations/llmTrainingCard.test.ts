import { describe, expect, it } from "vitest";
import { analyzeUrl } from "../../src/detection/analyzeUrl";
import {
  buildLlmTrainingCard,
  buildLlmTrainingCardPrompt,
  buildLlmTrainingCardWithFallback,
} from "../../src/explanations/llmTrainingCard";
import type { WebLlmEngineLike } from "../../src/explanations/webllmExplanation";

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

const VALID_CARD_JSON = [
  '{"giveaway":"The bit BEFORE the @ is just a username, not the destination.",',
  '"question":"Where will https://brand.com@192.168.0.1/login actually take you?",',
  '"options":[',
  '{"label":"192.168.0.1 — the part after the @.","correct":true},',
  '{"label":"brand.com — the part before the @.","correct":false},',
  '{"label":"Both — the browser splits the traffic.","correct":false}',
  '],"explanation":"Browsers treat the segment before @ as a username; the host comes after."}',
];

describe("buildLlmTrainingCardPrompt", () => {
  it("never includes the raw URL or path", async () => {
    const result = await fixtureResult();
    const text = buildLlmTrainingCardPrompt(result)
      .map((m) => m.content)
      .join("\n");
    expect(text).not.toContain("paypal.com@192.168.0.1");
    expect(text).not.toContain("next=http://evil.tk/steal");
  });

  it("instructs the model to return JSON with exactly one correct option", async () => {
    const result = await fixtureResult();
    const text = buildLlmTrainingCardPrompt(result)
      .map((m) => m.content)
      .join("\n");
    expect(text).toContain("Exactly one option must have correct=true");
    expect(text).toContain("Return JSON only");
  });
});

describe("buildLlmTrainingCard", () => {
  it("parses a streamed LLM card and returns a TrainingCard with one correct option", async () => {
    const result = await fixtureResult();
    const card = await buildLlmTrainingCard(result, {
      engine: streamingEngine(VALID_CARD_JSON),
    });
    expect(card.options).toHaveLength(3);
    expect(card.options.filter((o) => o.correct)).toHaveLength(1);
    expect(card.giveaway).toContain("@");
    expect(card.question.toLowerCase()).toContain("where");
    expect(card.sourceRuleId).toMatch(/embedded|phishing|ip|typosquat/);
  });

  it("throws when the JSON has zero correct options", async () => {
    const result = await fixtureResult();
    const badCard = [
      '{"giveaway":"x","question":"y","options":[',
      '{"label":"a","correct":false},',
      '{"label":"b","correct":false},',
      '{"label":"c","correct":false}',
      '],"explanation":"z"}',
    ];
    await expect(
      buildLlmTrainingCard(result, { engine: streamingEngine(badCard) }),
    ).rejects.toThrow(/exactly one correct/);
  });

  it("throws when fewer than 3 options are returned", async () => {
    const result = await fixtureResult();
    const tooFew = [
      '{"giveaway":"x","question":"y","options":[',
      '{"label":"a","correct":true},',
      '{"label":"b","correct":false}',
      '],"explanation":"z"}',
    ];
    await expect(
      buildLlmTrainingCard(result, { engine: streamingEngine(tooFew) }),
    ).rejects.toThrow(/3 or 4 options/);
  });

  it("strips ```json fences before parsing", async () => {
    const result = await fixtureResult();
    const fenced = ["```json\n", ...VALID_CARD_JSON, "\n```"];
    const card = await buildLlmTrainingCard(result, {
      engine: streamingEngine(fenced),
    });
    expect(card.options).toHaveLength(3);
  });
});

describe("buildLlmTrainingCardWithFallback", () => {
  it("returns null when the engine throws (caller substitutes the template card)", async () => {
    const result = await fixtureResult();
    const card = await buildLlmTrainingCardWithFallback(result, {
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
    expect(card).toBeNull();
  });

  it("returns the LLM card when generation succeeds", async () => {
    const result = await fixtureResult();
    const card = await buildLlmTrainingCardWithFallback(result, {
      engine: streamingEngine(VALID_CARD_JSON),
    });
    expect(card).not.toBeNull();
    expect(card!.options).toHaveLength(3);
  });
});

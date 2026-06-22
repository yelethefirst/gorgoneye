import * as ort from "onnxruntime-web";
import type { InferenceSession } from "onnxruntime-web";
import type { Predictor } from "./predictor";

export class OnnxPredictor implements Predictor {
  private sessionPromise: Promise<InferenceSession> | null = null;
  private loadError: Error | null = null;

  constructor(
    private readonly modelUrl: string,
  ) {}

  private async session(): Promise<InferenceSession> {
    if (this.loadError) throw this.loadError;
    if (this.sessionPromise) return this.sessionPromise;
    this.sessionPromise = (async () => {
      try {
        if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
          ort.env.wasm.wasmPaths = chrome.runtime.getURL("ort/");
        }
        ort.env.wasm.numThreads = 1;
        return await ort.InferenceSession.create(this.modelUrl, {
          executionProviders: ["wasm"],
          graphOptimizationLevel: "all",
        });
      } catch (err) {
        this.loadError = err instanceof Error ? err : new Error(String(err));
        throw this.loadError;
      }
    })();
    return this.sessionPromise;
  }

  async predict(features: Float32Array): Promise<number> {
    const session = await this.session();
    const tensor = new ort.Tensor("float32", features, [1, features.length]);
    const inputName = session.inputNames[0] ?? "input";
    const out = await session.run({ [inputName]: tensor });
    return extractPositiveProbability(out);
  }
}

function extractPositiveProbability(out: Record<string, unknown>): number {
  for (const key of Object.keys(out)) {
    const value = out[key];
    const probability = tryReadProbability(value);
    if (probability !== null) return probability;
  }
  throw new Error(
    `OnnxPredictor: could not locate probability output. Available outputs: ${Object.keys(out).join(", ")}`,
  );
}

function tryReadProbability(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  if ("data" in value && "dims" in value) {
    const v = value as { data: ArrayLike<number>; dims: readonly number[] };
    if (v.dims.length === 2 && v.dims[1] === 2 && v.data.length >= 2) {
      return Number(v.data[1]);
    }
    if (v.dims.length === 1 && v.data.length === 1) {
      return Number(v.data[0]);
    }
  }
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (first instanceof Map) {
      const p = first.get(1) ?? first.get("1");
      if (typeof p === "number") return p;
    } else if (first && typeof first === "object") {
      const obj = first as Record<string | number, unknown>;
      const p = obj[1] ?? obj["1"];
      if (typeof p === "number") return p;
    }
  }
  return null;
}

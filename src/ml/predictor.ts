/**
 * Abstraction over the actual inference backend.
 *
 * `Predictor` is the seam we mock in unit tests. `OnnxPredictor` (in
 * `onnxPredictor.ts`) is the real implementation that talks to
 * `onnxruntime-web`. Keeping the two apart means the rest of the codebase
 * (and most of the tests) never has to know about ONNX.
 */
export interface Predictor {
  /**
   * Returns the phishing probability in [0, 1] for the given feature vector.
   * MUST throw on any failure — the caller maps thrown errors to
   * `MlResult.status = "error"`.
   */
  predict(features: Float32Array): Promise<number>;
}

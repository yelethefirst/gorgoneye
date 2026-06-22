import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx", "src/**/*.test.ts"],
    // Playwright owns tests/e2e/; keep Vitest out so the two runners don't
    // attempt to load each other's specs.
    exclude: ["tests/e2e/**", "node_modules/**", ".output/**", ".wxt/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "coverage",
      // Focus coverage on code that has real behaviour. Excluding pure type
      // modules, ambient declarations, and entrypoint glue (which is exercised
      // by integration tests, not unit tests) keeps the gate meaningful.
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.test.ts",
        "src/types/**",
        "src/shared/messages.ts",
        "src/shared/audit.ts",
        "src/shared/parsedUrl.ts",
        "src/shared/verdict.ts",
        "src/storage/index.ts",
        "src/ui/**",
        "src/fixtures/**",
        // chrome.runtime-dependent glue; covered indirectly by integration in
        // the loaded extension, not in Node tests.
        "src/messaging/**",
        // Pure-type module — no executable code to cover.
        "src/rules/types.ts",
        // Real onnxruntime-web integration. Loads WASM at runtime; can't be
        // exercised from Node-side Vitest. Covered by the Playwright E2E
        // (loads the built extension with the real runtime). The wrapper
        // (`mlClient.ts`) is fully unit-tested via a mock predictor.
        "src/ml/onnxPredictor.ts",
        // Same shape as onnxPredictor: the WebLLM lazy-load path imports
        // @mlc-ai/web-llm dynamically and constructs a session that needs
        // WebGPU. The streaming/parse/fallback/abort logic IS unit-tested
        // via the WebLlmEngineLike mock seam in webllmExplanation.test.ts.
        // The lazy-load + InitProgressReport branches are deferred to the
        // hardware verification step (runbook task 1).
        "src/explanations/webllmExplanation.ts",
      ],
      thresholds: {
        // Floor for the core detection stack (AEG-11-1).
        "src/rules/**/*.ts": { lines: 80, functions: 80, statements: 80 },
        "src/detection/**/*.ts": { lines: 80, functions: 80, statements: 80 },
        "src/threat-intel/**/*.ts": { lines: 80, functions: 80, statements: 80 },
        "src/audit/**/*.ts": { lines: 80, functions: 80, statements: 80 },
        "src/privacy/**/*.ts": { lines: 80, functions: 80, statements: 80 },
        "src/explanations/**/*.ts": { lines: 80, functions: 80, statements: 80 },
        "src/ml/**/*.ts": { lines: 80, functions: 80, statements: 80 },
        "src/visual/**/*.ts": { lines: 80, functions: 80, statements: 80 },
      },
    },
  },
});

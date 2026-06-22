#!/usr/bin/env node
/**
 * Copies onnxruntime-web's distribution files into public/ort/ so WXT picks
 * them up as static assets. This must run BEFORE pnpm build / dev so the
 * files are present when WXT scans the public directory.
 *
 * onnxruntime-web at runtime loads its WASM blob relative to the running
 * script's URL via env.wasm.wasmPaths; we set that path inside
 * `src/ml/onnxPredictor.ts` to `chrome.runtime.getURL("ort/")`.
 *
 * Only .wasm and .mjs files are copied — the JS shim ships in the bundle.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PUBLIC_ORT = resolve(ROOT, "public", "ort");

function findOrtDist() {
  const direct = resolve(ROOT, "node_modules", "onnxruntime-web", "dist");
  if (existsSync(direct)) return direct;

  const pnpm = resolve(ROOT, "node_modules", ".pnpm");
  if (!existsSync(pnpm)) return null;
  for (const dir of readdirSync(pnpm)) {
    if (!dir.startsWith("onnxruntime-web@")) continue;
    const candidate = resolve(pnpm, dir, "node_modules", "onnxruntime-web", "dist");
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function main() {
  const src = findOrtDist();
  if (!src) {
    console.error("[copy-ort] onnxruntime-web dist not found; skipping.");
    process.exitCode = 0;
    return;
  }
  mkdirSync(PUBLIC_ORT, { recursive: true });

  // We only ship .wasm files. The .mjs shims are already bundled by Vite via
  // the `import("onnxruntime-web")` dynamic import. JSEP / JSPI / asyncify
  // variants matter only for advanced execution providers; we set
  // executionProviders=["wasm"] + numThreads=1, so the runtime picks the
  // SIMD-threaded WASM and runs it single-threaded. We additionally include
  // `asyncify` as a fallback for runtimes that don't support
  // wasm-multi-threading at all.
  const WANTED = new Set([
    "ort-wasm-simd-threaded.wasm",
    "ort-wasm-simd-threaded.asyncify.wasm",
  ]);
  let copied = 0;
  let bytes = 0;
  for (const file of readdirSync(src)) {
    if (!WANTED.has(file)) continue;
    const srcPath = resolve(src, file);
    const outPath = resolve(PUBLIC_ORT, file);
    copyFileSync(srcPath, outPath);
    copied += 1;
    bytes += statSync(outPath).size;
  }
  const mb = (bytes / 1024 / 1024).toFixed(1);
  console.info(`[copy-ort] copied ${copied} WASM file(s) (${mb} MB) -> ${PUBLIC_ORT}`);
}

main();

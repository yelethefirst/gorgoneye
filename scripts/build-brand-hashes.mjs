#!/usr/bin/env node
/**
 * Recomputes brand pHashes from a directory of PNG screenshots and emits a
 * JSON suitable for `src/visual/brandDb.ts`.
 *
 * Usage:
 *   node scripts/build-brand-hashes.mjs <input-dir> <output.json>
 *
 *   input-dir/
 *     paypal.png       — screenshot of paypal.com/signin (1024x768 or larger)
 *     paypal.meta.json — { "brand": "PayPal", "legitimateDomains": ["paypal.com"], ... }
 *     microsoft.png
 *     microsoft.meta.json
 *     …
 *
 * Each PNG is decoded with pngjs, fed to the pure pHash algorithm
 * (`src/visual/phash.ts`), and the resulting bigint is stamped into the
 * matching entry alongside `capturedAt`. Real captures should be reviewed by
 * a second pair of eyes before merging — they affect product accuracy.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, basename, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const usage = "Usage: node scripts/build-brand-hashes.mjs <input-dir> <output.json>";
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error(usage);
  process.exit(2);
}
const [inputDir, outputPath] = args.map((p) => resolve(p));

let PNG;
try {
  const mod = await import("pngjs");
  PNG = mod.PNG;
} catch {
  console.error(
    "[build-brand-hashes] Missing optional dep `pngjs`. Install it with:\n" +
      "    pnpm add -D pngjs\n" +
      "or run this script from a place that has it on the path.",
  );
  process.exit(2);
}

const phashMod = await import(resolve(__dirname, "..", "src", "visual", "phash.ts"));
const { perceptualHash, pHashToHex } = phashMod;

const today = new Date().toISOString().slice(0, 10);

const entries = [];
for (const file of readdirSync(inputDir)) {
  if (extname(file).toLowerCase() !== ".png") continue;
  const stem = basename(file, ".png");
  const metaPath = join(inputDir, `${stem}.meta.json`);
  let meta;
  try {
    meta = JSON.parse(readFileSync(metaPath, "utf-8"));
  } catch {
    console.warn(`[build-brand-hashes] Skipping ${file} — missing or invalid ${stem}.meta.json`);
    continue;
  }
  const png = PNG.sync.read(readFileSync(join(inputDir, file)));
  const hash = perceptualHash({
    width: png.width,
    height: png.height,
    data: png.data,
  });
  entries.push({
    brand: meta.brand,
    legitimateDomains: meta.legitimateDomains,
    pHashHex: pHashToHex(hash),
    capturedAt: meta.capturedAt ?? today,
    captureNotes: meta.captureNotes ?? `Real screenshot capture (${file}).`,
  });
  console.info(`[build-brand-hashes] ${meta.brand} -> ${pHashToHex(hash)}`);
}

writeFileSync(outputPath, JSON.stringify({ brands: entries }, null, 2) + "\n");
console.info(
  `[build-brand-hashes] wrote ${entries.length} entries -> ${outputPath}. ` +
    "Have a second reviewer inspect the file before merging.",
);

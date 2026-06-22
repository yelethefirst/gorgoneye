import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { parseUrl } from "../../src/rules/parseUrl";
import { extractFeaturesByName } from "../../src/ml/features";
import { FEATURE_SCHEMA_VERSION } from "../../src/ml/featureSchema";
import { SNAPSHOT_URLS } from "./snapshotUrls";

const SNAPSHOT_PATH = resolve(__dirname, "__snapshots__/featureParity.json");

interface ParityRow {
  url: string;
  features: Record<string, number>;
}
interface ParityPayload {
  featureSchemaVersion: string;
  generatedBy: string;
  rows: ParityRow[];
}

function currentRows(): ParityRow[] {
  return SNAPSHOT_URLS.map((url) => ({
    url,
    features: extractFeaturesByName(parseUrl(url)),
  }));
}

function loadSnapshot(): ParityPayload {
  if (!existsSync(SNAPSHOT_PATH)) {
    mkdirSync(resolve(__dirname, "__snapshots__"), { recursive: true });
    const payload: ParityPayload = {
      featureSchemaVersion: FEATURE_SCHEMA_VERSION,
      generatedBy: "tests/ml/features.parity.test.ts (auto-generated on first run)",
      rows: currentRows(),
    };
    writeFileSync(SNAPSHOT_PATH, JSON.stringify(payload, null, 2) + "\n");
    return payload;
  }
  return JSON.parse(readFileSync(SNAPSHOT_PATH, "utf-8")) as ParityPayload;
}

describe("feature parity snapshot (AEG-3-5)", () => {
  const snapshot = loadSnapshot();

  it("the snapshot's schema version matches the live schema version", () => {
    expect(snapshot.featureSchemaVersion).toBe(FEATURE_SCHEMA_VERSION);
  });

  it("covers every URL in SNAPSHOT_URLS", () => {
    expect(snapshot.rows.map((r) => r.url)).toEqual([...SNAPSHOT_URLS]);
  });

  it.each(SNAPSHOT_URLS)("matches the frozen vector for %s", (url) => {
    const row = snapshot.rows.find((r) => r.url === url);
    expect(row, `snapshot row missing for ${url}`).toBeDefined();
    const expected = row!.features;
    const actual = extractFeaturesByName(parseUrl(url));
    expect(Object.keys(actual)).toEqual(Object.keys(expected));
    for (const key of Object.keys(expected)) {
      expect(actual[key], `divergence on feature "${key}" for ${url}`).toBeCloseTo(
        expected[key]!,
        6,
      );
    }
  });
});

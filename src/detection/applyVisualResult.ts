import type {
  AnalysisResult,
  VisualResult,
} from "../shared/verdict";
import { fuseLayers, verdictFromScore, type LayerContribution } from "./fusion";

/**
 * Re-fuses an existing `AnalysisResult` with a new `VisualResult` produced
 * by a consented `VisualClient.inspect()` call, returning the updated
 * result. We avoid re-running the rules, threat-intel, and ML layers —
 * those are already cached — and only patch the visual layer in.
 *
 * Adds a `visual_brand_spoof` fired signal if the visual layer confirms a
 * spoof, and updates the privacy summary's `targetOriginContacted` flag.
 */
export function applyVisualResult(
  existing: AnalysisResult,
  visual: VisualResult,
): AnalysisResult {
  const rulesScore = existing.layers.rules.score;
  const tiMatched = existing.layers.threatIntel?.matched ?? false;
  const ml = existing.layers.ml;

  const contributions: LayerContribution[] = [{ layer: "rules", score: rulesScore }];
  if (tiMatched) contributions.push({ layer: "threat_intel", score: 1 });
  if (ml?.status === "complete" && typeof ml.probability === "number" && ml.probability >= 0.6) {
    contributions.push({ layer: "ml", score: ml.probability });
  }
  if (visual.status === "complete" && typeof visual.score === "number" && visual.score > 0) {
    contributions.push({ layer: "visual", score: visual.score });
  }
  const fusedScore = fuseLayers(contributions);
  const verdict = verdictFromScore(fusedScore);

  // Drop any prior visual signal so we don't double up across repeated
  // inspections, then append the new one if a spoof was confirmed.
  const signals = existing.firedSignals.filter((s) => s.layer !== "visual");
  if (visual.status === "complete" && visual.matchedBrand && (visual.score ?? 0) > 0) {
    signals.push({
      layer: "visual",
      id: "visual_brand_spoof",
      severity: "high",
      title: `Visual match against ${visual.matchedBrand}`,
      detail: `Hamming distance ${visual.hammingDistance} (similarity ${Math.round(
        (visual.similarity ?? 0) * 100,
      )}%); hostname is not on this brand's legitimate-domain list.`,
    });
  }

  const unavailable = existing.unavailableLayers.filter((u) => u.layer !== "visual");

  return {
    ...existing,
    verdict,
    confidence: fusedScore,
    layers: { ...existing.layers, visual },
    firedSignals: signals,
    timings: {
      ...existing.timings,
    },
    privacy: {
      ...existing.privacy,
      targetOriginContacted:
        existing.privacy.targetOriginContacted || Boolean(visual.targetOriginContacted),
    },
    unavailableLayers: unavailable,
  };
}

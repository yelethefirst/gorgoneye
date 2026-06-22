import { analyzeUrl } from "../src/detection/analyzeUrl";
import type { AnalysisResult } from "../src/shared/verdict";

async function scan(url: string): Promise<AnalysisResult> {
  return analyzeUrl({
    url,
    context: { surface: "popup_manual_scan", userGesture: "manual_scan" },
  });
}

(window as unknown as Record<string, unknown>).AegisScanner = { scan };

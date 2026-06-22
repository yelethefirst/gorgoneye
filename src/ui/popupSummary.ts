import type { AnalysisResult } from "../shared/verdict";

export interface CountSummary {
  total: number;
  safe: number;
  suspicious: number;
  phishing: number;
  unknown: number;
}

export function summarizeVerdicts(verdicts: AnalysisResult[]): CountSummary {
  return verdicts.reduce<CountSummary>(
    (acc, v) => ({
      total: acc.total + 1,
      safe: acc.safe + (v.verdict === "safe" ? 1 : 0),
      suspicious: acc.suspicious + (v.verdict === "suspicious" ? 1 : 0),
      phishing: acc.phishing + (v.verdict === "phishing" ? 1 : 0),
      unknown: acc.unknown + (v.verdict === "unknown" ? 1 : 0),
    }),
    { total: 0, safe: 0, suspicious: 0, phishing: 0, unknown: 0 },
  );
}

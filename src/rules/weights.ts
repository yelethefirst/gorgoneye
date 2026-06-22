// Default weights for rule signals. Centralized so UI, fusion, and tests share one source.
// Values reflect the table in docs/architecture/detection-pipeline.md.
export const RULE_WEIGHTS = {
  ip_hostname: 0.7,
  punycode: 0.55,
  mixed_script: 0.6,
  typosquatting: 0.75,
  suspicious_tld: 0.35,
  excessive_subdomains: 0.35,
  credential_keywords: 0.3,
  embedded_credentials: 0.8,
  url_in_url: 0.45,
  excessive_length: 0.35,
} as const;

export type RuleId = keyof typeof RULE_WEIGHTS;

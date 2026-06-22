import type { Rule } from "./types";
import { ipHostnameRule } from "./rules/ipHostname";
import { punycodeHomographRule } from "./rules/punycodeHomograph";
import { typosquattingRule } from "./rules/typosquatting";
import { suspiciousTldRule } from "./rules/suspiciousTld";
import { excessiveSubdomainsRule } from "./rules/excessiveSubdomains";
import { credentialKeywordsRule } from "./rules/credentialKeywords";
import { embeddedCredentialsRule } from "./rules/embeddedCredentials";
import { urlInUrlRule } from "./rules/urlInUrl";
import { excessiveLengthRule } from "./rules/excessiveLength";

// Deterministic order. Mirrors the rule table in
// docs/architecture/detection-pipeline.md so UI and explanation output stay stable.
export const DEFAULT_RULES: readonly Rule[] = [
  ipHostnameRule,
  punycodeHomographRule,
  typosquattingRule,
  suspiciousTldRule,
  excessiveSubdomainsRule,
  credentialKeywordsRule,
  embeddedCredentialsRule,
  urlInUrlRule,
  excessiveLengthRule,
];

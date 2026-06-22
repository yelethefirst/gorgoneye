import punycode from "punycode/";
import type { ParsedUrl } from "../../shared/parsedUrl";
import type { RuleSignal, SignalSeverity } from "../../shared/verdict";
import type { Rule } from "../types";
import { RULE_WEIGHTS } from "../weights";

// Scripts whose letters can be visually confused with Latin in domain labels.
// Limited to the small set we explicitly want to flag when mixed with each other
// in a single label. Adding more scripts here would broaden detection.
const SCRIPT_TESTS: Array<{ name: string; re: RegExp }> = [
  { name: "Latin", re: /\p{Script=Latin}/u },
  { name: "Cyrillic", re: /\p{Script=Cyrillic}/u },
  { name: "Greek", re: /\p{Script=Greek}/u },
  { name: "Armenian", re: /\p{Script=Armenian}/u },
];

function safeDecodeHostname(hostname: string): string {
  try {
    return punycode.toUnicode(hostname);
  } catch {
    return hostname;
  }
}

function labelScripts(label: string): string[] {
  const found = new Set<string>();
  for (const char of label) {
    for (const { name, re } of SCRIPT_TESTS) {
      if (re.test(char)) {
        found.add(name);
        break;
      }
    }
  }
  return Array.from(found);
}

interface ScriptFinding {
  label: string;
  scripts: string[];
}

function findMixedScriptLabels(unicodeHostname: string): ScriptFinding[] {
  const findings: ScriptFinding[] = [];
  for (const label of unicodeHostname.split(".")) {
    if (!label) continue;
    const scripts = labelScripts(label);
    if (scripts.length > 1) findings.push({ label, scripts });
  }
  return findings;
}

export const punycodeHomographRule: Rule = {
  id: "punycode",
  name: "Punycode / homograph hostname",
  defaultWeight: RULE_WEIGHTS.punycode,

  evaluate(parsed: ParsedUrl): RuleSignal {
    const weight = RULE_WEIGHTS.punycode;
    const notFired: RuleSignal = {
      id: "punycode",
      layer: "rules",
      name: "Punycode / homograph hostname",
      fired: false,
      severity: "info",
      weight,
      score: 0,
      description: "Hostname uses a single, plain ASCII script.",
      evidence: {},
    };

    if (!parsed.hostname || parsed.isIpAddress) return notFired;

    const decoded = safeDecodeHostname(parsed.hostname);
    const mixedLabels = findMixedScriptLabels(decoded);
    const hasMixedScript = mixedLabels.length > 0;
    const isPunycode = parsed.isPunycode;

    if (!hasMixedScript && !isPunycode) return notFired;

    // Mixed-script labels are a stronger signal than plain punycode.
    const severity: SignalSeverity = hasMixedScript ? "high" : "medium";
    const score = hasMixedScript ? Math.min(1, weight + RULE_WEIGHTS.mixed_script) : weight;

    const reasons: string[] = [];
    if (isPunycode) reasons.push("hostname uses punycode (xn-- labels)");
    if (hasMixedScript) reasons.push("at least one label mixes visually confusable scripts");

    return {
      id: "punycode",
      layer: "rules",
      name: "Punycode / homograph hostname",
      fired: true,
      severity,
      weight,
      score,
      description: `Hostname display form is "${decoded}". This may be a homograph attack: ${reasons.join("; ")}.`,
      evidence: {
        encodedHostname: parsed.hostname,
        decodedHostname: decoded,
        usesPunycode: isPunycode,
        hasMixedScriptLabel: hasMixedScript,
        mixedScriptLabels: mixedLabels.map((f) => `${f.label} [${f.scripts.join("+")}]`),
      },
    };
  },
};

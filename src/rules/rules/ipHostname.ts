import type { ParsedUrl } from "../../shared/parsedUrl";
import type { RuleSignal } from "../../shared/verdict";
import type { Rule } from "../types";
import { RULE_WEIGHTS } from "../weights";

function classify(parsed: ParsedUrl): "ipv4" | "ipv6" | null {
  if (!parsed.isIpAddress || !parsed.hostname) return null;
  const isBracketed = parsed.hostname.startsWith("[") && parsed.hostname.endsWith("]");
  if (isBracketed || parsed.hostname.includes(":")) return "ipv6";
  return "ipv4";
}

export const ipHostnameRule: Rule = {
  id: "ip_hostname",
  name: "IP-literal hostname",
  defaultWeight: RULE_WEIGHTS.ip_hostname,

  evaluate(parsed: ParsedUrl): RuleSignal {
    const flavor = classify(parsed);
    const fired = flavor !== null;
    const weight = RULE_WEIGHTS.ip_hostname;
    return {
      id: "ip_hostname",
      layer: "rules",
      name: "IP-literal hostname",
      fired,
      severity: fired ? "high" : "info",
      weight,
      score: fired ? weight : 0,
      description: fired
        ? "Hostname is a raw IP address. Legitimate services almost always use a domain name, so this is a strong phishing signal."
        : "Hostname uses a domain name rather than a raw IP address.",
      evidence: fired
        ? {
            hostname: parsed.hostname ?? "",
            ipVersion: flavor,
          }
        : {},
    };
  },
};

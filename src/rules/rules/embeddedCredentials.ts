import type { ParsedUrl } from "../../shared/parsedUrl";
import type { RuleSignal } from "../../shared/verdict";
import type { Rule } from "../types";
import { RULE_WEIGHTS } from "../weights";

function extractUserinfo(originalUrl: string): string | null {
  const schemeEnd = originalUrl.indexOf("://");
  if (schemeEnd === -1) return null;
  const afterScheme = originalUrl.slice(schemeEnd + 3);
  const at = afterScheme.indexOf("@");
  if (at === -1) return null;
  const pathStart = afterScheme.search(/[/?#]/);
  if (pathStart !== -1 && at > pathStart) return null;
  return afterScheme.slice(0, at);
}

export const embeddedCredentialsRule: Rule = {
  id: "embedded_credentials",
  name: "Embedded credentials / @-trick",
  defaultWeight: RULE_WEIGHTS.embedded_credentials,

  evaluate(parsed: ParsedUrl): RuleSignal {
    const weight = RULE_WEIGHTS.embedded_credentials;
    if (parsed.parseError) {
      return notFired(weight, "URL did not parse; cannot inspect userinfo.");
    }

    const userinfo = extractUserinfo(parsed.originalUrl);
    if (!userinfo) return notFired(weight, "URL has no userinfo segment.");

    return {
      id: "embedded_credentials",
      layer: "rules",
      name: "Embedded credentials / @-trick",
      fired: true,
      severity: "high",
      weight,
      score: weight,
      description:
        "URL contains userinfo (text before '@' in the host). This is a classic obfuscation trick: the part the user reads on the left of '@' is not the real destination.",
      evidence: {
        userinfoLength: userinfo.length,
        realHostname: parsed.hostname ?? "",
        hasPassword: userinfo.includes(":"),
      },
    };
  },
};

function notFired(weight: number, description: string): RuleSignal {
  return {
    id: "embedded_credentials",
    layer: "rules",
    name: "Embedded credentials / @-trick",
    fired: false,
    severity: "info",
    weight,
    score: 0,
    description,
    evidence: {},
  };
}

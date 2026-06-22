import type { AnalysisResult } from "../../shared/verdict";

export interface TrainingOption {
  label: string;
  correct: boolean;
}

export interface TrainingCard {
  /** Short title of the giveaway being highlighted. */
  giveaway: string;
  /** The multiple-choice question. */
  question: string;
  /** 3-4 options, exactly one marked correct. */
  options: TrainingOption[];
  /** One-sentence explanation shown after the user picks. */
  explanation: string;
  /** ID of the rule the card was generated from, for analytics if ever enabled. */
  sourceRuleId: string;
}

interface RuleEvidence {
  matchedBrand?: string;
  matchedBrandDomain?: string;
  hostname?: string;
  ipVersion?: string;
  realHostname?: string;
  decodedHostname?: string;
  embeddedSurface?: string;
}

function findFiredSignal(result: AnalysisResult, id: string) {
  return result.layers.rules.signals.find((s) => s.id === id && s.fired);
}

/**
 * Builds a single training card from an `AnalysisResult` if (and only if) the
 * verdict is "phishing". The card focuses on the highest-impact fired signal
 * the analysis surfaced. Returns `null` for any other verdict so the popup
 * doesn't show training noise on suspicious / safe links.
 *
 * The card is intentionally short: one giveaway sentence, one question, three
 * options. The user can dismiss at any time.
 */
export function buildTrainingCard(result: AnalysisResult): TrainingCard | null {
  if (result.verdict !== "phishing") return null;

  // Priority order: typosquatting > embedded credentials > IP hostname > URL-in-URL >
  // punycode/homograph > fallback. This mirrors the severity ordering used by
  // the explanation template and keeps the user looking at the most
  // teachable signal.

  const typo = findFiredSignal(result, "typosquatting");
  if (typo) {
    const ev = typo.evidence as RuleEvidence;
    const brand = ev.matchedBrand ?? "a real brand";
    const brandDomain = ev.matchedBrandDomain ?? "the real domain";
    return {
      giveaway: `The domain looks like ${brand}, but it isn't.`,
      question: `Why is this URL dangerous if it advertises ${brand}?`,
      options: shuffleKnown([
        {
          label: `The domain is a typo away from ${brandDomain} — it's impersonating the brand.`,
          correct: true,
        },
        {
          label: `${brand} doesn't run a website at all.`,
          correct: false,
        },
        {
          label: `The page is secure because it uses HTTPS.`,
          correct: false,
        },
      ]),
      explanation: `Typosquatting works by swapping a letter for a lookalike (often "0" for "o" or "1" for "l"). Always check the registrable domain matches the brand you expect — here, look for ${brandDomain}.`,
      sourceRuleId: "typosquatting",
    };
  }

  const embed = findFiredSignal(result, "embedded_credentials");
  if (embed) {
    const ev = embed.evidence as RuleEvidence;
    const realHost = ev.realHostname ?? "the real destination";
    return {
      giveaway: `What you read on the left of "@" is NOT where the link goes.`,
      question: `In a URL like https://brand.com@${realHost}/login, where do you actually end up?`,
      options: shuffleKnown([
        { label: `${realHost} — the part AFTER the "@".`, correct: true },
        { label: `brand.com — the part BEFORE the "@".`, correct: false },
        { label: `Both — the browser splits the traffic.`, correct: false },
      ]),
      explanation: `The portion before "@" in a URL is treated as a username, not as the destination. Browsers will navigate to whatever follows the "@".`,
      sourceRuleId: "embedded_credentials",
    };
  }

  const ip = findFiredSignal(result, "ip_hostname");
  if (ip) {
    const ev = ip.evidence as RuleEvidence;
    const version = ev.ipVersion === "ipv6" ? "IPv6" : "IPv4";
    return {
      giveaway: `Legitimate services don't use raw ${version} addresses for their login pages.`,
      question: `What does it usually mean when a "login" page lives at a raw IP address?`,
      options: shuffleKnown([
        {
          label: `The site is hiding the real domain — a classic phishing-kit pattern.`,
          correct: true,
        },
        {
          label: `The site is faster because it skips DNS.`,
          correct: false,
        },
        {
          label: `The site is using IPv6 for security.`,
          correct: false,
        },
      ]),
      explanation: `Phishing kits are often deployed on disposable infrastructure where the attacker hasn't registered a domain at all. A login page at a raw IP is almost always malicious.`,
      sourceRuleId: "ip_hostname",
    };
  }

  const redirect = findFiredSignal(result, "url_in_url");
  if (redirect) {
    return {
      giveaway: `The URL contains ANOTHER URL inside its ${(redirect.evidence as RuleEvidence).embeddedSurface ?? "query"}.`,
      question: `Why is "?to=https://other-site.example/login" inside a URL a red flag?`,
      options: shuffleKnown([
        {
          label: `It's an open-redirect pattern — the visible domain isn't where you'll end up.`,
          correct: true,
        },
        {
          label: `It's how email tracking links work; safe to ignore.`,
          correct: false,
        },
        {
          label: `It means the site is open-source.`,
          correct: false,
        },
      ]),
      explanation: `Open redirects let attackers borrow the reputation of a trusted domain. The "outer" host might be a real brand, but you'll be sent to whatever URL is embedded inside.`,
      sourceRuleId: "url_in_url",
    };
  }

  const puny = findFiredSignal(result, "punycode");
  if (puny) {
    const ev = puny.evidence as RuleEvidence;
    const decoded = ev.decodedHostname ?? "a non-Latin script";
    return {
      giveaway: `The domain uses lookalike characters from a different alphabet (${decoded}).`,
      question: `Why is a domain like xn--80ak6aa92e.com risky even though Chrome renders it as "apple.com"?`,
      options: shuffleKnown([
        {
          label: `The characters are from a different script — a homograph attack imitating the real domain.`,
          correct: true,
        },
        {
          label: `xn-- is the standard prefix for premium domains.`,
          correct: false,
        },
        {
          label: `It's a shortened Bitly-style URL.`,
          correct: false,
        },
      ]),
      explanation: `Punycode (xn--) is how non-ASCII domains are encoded. Attackers register IDN domains whose Cyrillic/Greek/Armenian characters look identical to Latin letters.`,
      sourceRuleId: "punycode",
    };
  }

  // Fallback: still a phishing verdict but no specific high-severity rule fired —
  // surface the first fired-signal title and a generic question.
  const top = result.firedSignals[0];
  return {
    giveaway: top ? top.title : "Multiple risk signals fired on this URL.",
    question: `What's the safest action when a phishing verdict appears?`,
    options: shuffleKnown([
      { label: "Close the tab and visit the brand's site from a bookmark.", correct: true },
      { label: "Click anyway to see what happens.", correct: false },
      { label: "Enter fake credentials to confuse the attacker.", correct: false },
    ]),
    explanation:
      "Even credentials you think are fake can leak metadata about you. The reliable response is to leave the page and reach the legitimate site through a channel you trust.",
    sourceRuleId: top?.id ?? "phishing_generic",
  };
}

/**
 * Deterministic shuffle that places the correct answer in a position derived
 * from the option labels themselves. We avoid Math.random because the popup
 * re-renders frequently and answers shouldn't keep moving.
 */
function shuffleKnown(options: TrainingOption[]): TrainingOption[] {
  const sum = options.reduce((acc, o) => acc + o.label.length, 0);
  const offset = sum % options.length;
  const rotated = [...options.slice(offset), ...options.slice(0, offset)];
  return rotated;
}

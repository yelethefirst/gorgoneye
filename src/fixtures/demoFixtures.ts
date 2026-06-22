import type { Verdict } from "../shared/verdict";
import type { RuleId } from "../rules/weights";

export interface DemoFixture {
  url: string;
  expectedVerdict: Verdict;
  /** Rule IDs that MUST fire for this fixture. Other rules may also fire. */
  expectedRules: RuleId[];
  description: string;
}

/**
 * Curated fixtures for demos, smoke tests, and regression coverage.
 * Each entry asserts both a final verdict bucket and the specific rules that
 * fire, so changes to weights or new rules surface as test failures.
 *
 * Constraints:
 *   - No live phishing dependencies; all hostnames are synthetic.
 *   - Verdict bucket = the value the fusion engine returns for rules-only
 *     analysis (no ML, no threat-intel). Adding those layers later may
 *     increase confidence but should not flip a fixture across buckets.
 */
export const DEMO_FIXTURES: DemoFixture[] = [
  // ────────── Phishing (8) ──────────
  {
    url: "https://paypa1.example/account/verify",
    expectedVerdict: "phishing",
    expectedRules: ["typosquatting", "credential_keywords"],
    description: "Digit-for-letter typosquat of PayPal plus credential keywords.",
  },
  {
    url: "https://goog1e.com/secure/login",
    expectedVerdict: "phishing",
    expectedRules: ["typosquatting", "credential_keywords"],
    description: "Typosquat of google.com with login keywords.",
  },
  {
    url: "https://micr0soft.net/account",
    expectedVerdict: "phishing",
    expectedRules: ["typosquatting", "credential_keywords"],
    description: "Microsoft typosquat on a different TLD.",
  },
  {
    url: "http://paypal.com@192.168.0.1/login",
    expectedVerdict: "phishing",
    expectedRules: ["ip_hostname", "embedded_credentials", "credential_keywords"],
    description: "Classic @-trick: brand in userinfo, IP literal as real host.",
  },
  {
    url: "http://paypal.com@evil.example/login?next=http://attacker.tld/steal",
    expectedVerdict: "phishing",
    expectedRules: ["embedded_credentials", "credential_keywords", "url_in_url"],
    description: "@-trick combined with open-redirect query.",
  },
  {
    url: "http://10.0.0.1/account/verify",
    expectedVerdict: "phishing",
    expectedRules: ["ip_hostname", "credential_keywords"],
    description: "Raw IPv4 host with credential-bearing path.",
  },
  {
    url: "https://amaz0n.shop/secure-update",
    expectedVerdict: "phishing",
    expectedRules: ["typosquatting", "credential_keywords"],
    description: "Amazon typosquat (zero-for-o) on a generic TLD.",
  },
  {
    url: "https://netfllx.net/login-account",
    expectedVerdict: "phishing",
    expectedRules: ["typosquatting", "credential_keywords"],
    description: "Netflix typosquat with login-account path.",
  },

  // ────────── Suspicious (9) ──────────
  {
    url: "https://shop.example.co.uk/account/login",
    expectedVerdict: "suspicious",
    expectedRules: ["credential_keywords"],
    description: "Otherwise clean URL with credential keywords in the path.",
  },
  {
    url: "https://promo.top/free-stuff",
    expectedVerdict: "suspicious",
    expectedRules: ["suspicious_tld"],
    description: "Suspicious .top TLD with no other indicators.",
  },
  {
    url: "https://invoice.zip/file",
    expectedVerdict: "suspicious",
    expectedRules: ["suspicious_tld"],
    description: "Recently-allocated .zip TLD reportedly abused for phishing.",
  },
  {
    url: "https://example.com/r?to=https://attacker.example/login",
    expectedVerdict: "suspicious",
    expectedRules: ["url_in_url", "credential_keywords"],
    description: "Open-redirect query pointing at a credential page.",
  },
  {
    url: "https://a.b.c.d.example.com/",
    expectedVerdict: "suspicious",
    expectedRules: ["excessive_subdomains"],
    description: "Four subdomain labels — common phishing-kit pattern.",
  },
  {
    url: "https://xn--80ak6aa92e.com/",
    expectedVerdict: "suspicious",
    expectedRules: ["punycode"],
    description: "Pure punycode hostname (no mixed-script).",
  },
  {
    url: "https://promo.click/account",
    expectedVerdict: "suspicious",
    expectedRules: ["suspicious_tld", "credential_keywords"],
    description: "Suspicious TLD plus credential keyword.",
  },
  {
    url: "https://api.example/login",
    expectedVerdict: "suspicious",
    expectedRules: ["credential_keywords"],
    description: "Reserved .example TLD with login path — borderline single-rule fire.",
  },
  {
    url: "https://example.com/recover/password?token=abcd1234",
    expectedVerdict: "suspicious",
    expectedRules: ["credential_keywords"],
    description: "Recovery/password keyword in a long token-bearing path.",
  },

  // ────────── Safe (8) ──────────
  {
    url: "https://github.com/aegishield/aegis-gorgon",
    expectedVerdict: "safe",
    expectedRules: [],
    description: "Known good registrable domain, benign path.",
  },
  {
    url: "https://news.ycombinator.com/item?id=42",
    expectedVerdict: "safe",
    expectedRules: [],
    description: "Common news aggregator.",
  },
  {
    url: "https://en.wikipedia.org/wiki/Phishing",
    expectedVerdict: "safe",
    expectedRules: [],
    description: "Phishing reference page — 'phishing' is not a credential keyword.",
  },
  {
    url: "https://docs.github.com/en/get-started",
    expectedVerdict: "safe",
    expectedRules: [],
    description: "GitHub docs subdomain.",
  },
  {
    url: "https://www.example.com/blog/article-2024",
    expectedVerdict: "safe",
    expectedRules: [],
    description: "Marketing blog post.",
  },
  {
    url: "https://store.example.io/products/abc-123",
    expectedVerdict: "safe",
    expectedRules: [],
    description: "E-commerce product URL.",
  },
  {
    url: "https://api.example.dev/v1/users",
    expectedVerdict: "safe",
    expectedRules: [],
    description: "API endpoint on .dev TLD (not in suspicious list).",
  },
  {
    url: "https://reactjs.org/docs/getting-started.html",
    expectedVerdict: "safe",
    expectedRules: [],
    description: "Framework docs page.",
  },
];

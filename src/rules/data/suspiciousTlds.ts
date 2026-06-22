// Public-suffix values frequently abused for phishing or low-quality registrations.
// Compared exactly against `ParsedUrl.publicSuffix`, so multi-label suffixes such
// as "co.uk" or "github.io" are unaffected unless explicitly listed here.
// Adjust via createSuspiciousTldRule({ tlds }).
export const DEFAULT_SUSPICIOUS_TLDS: readonly string[] = [
  "tk",
  "ml",
  "ga",
  "cf",
  "gq",
  "top",
  "xyz",
  "click",
  "country",
  "work",
  "link",
  "zip",
  "mov",
  "kim",
  "support",
  "win",
  "loan",
  "party",
  "gdn",
  "science",
  "icu",
  "monster",
  "quest",
  "lol",
  "fit",
  "rest",
  "cyou",
  "cam",
];

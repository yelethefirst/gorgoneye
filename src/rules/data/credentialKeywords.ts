// Credential-related keywords that frequently appear in phishing URL paths/queries.
// Weak signal alone; useful in combination with brand/redirect signals.
export const DEFAULT_CREDENTIAL_KEYWORDS: readonly string[] = [
  "login",
  "signin",
  "verify",
  "verification",
  "secure",
  "update",
  "suspend",
  "suspended",
  "account",
  "password",
  "passwd",
  "confirm",
  "validate",
  "reset",
  "unlock",
  "billing",
  "authenticate",
  "oauth",
  "wallet",
  "recovery",
];

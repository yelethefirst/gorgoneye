/**
 * Stable list of URLs the parity snapshot covers. Adding a URL here means
 * regenerating the snapshot AND updating the Python pipeline so the same row
 * appears in its own assertion table.
 *
 * Mix is deliberate:
 *   - benign multi-label (github + wikipedia)
 *   - credential-bearing
 *   - IP literal
 *   - userinfo @-trick
 *   - URL-in-URL
 *   - typosquat
 *   - punycode
 *   - long URL (length bucket coverage)
 *   - reserved TLD
 */
export const SNAPSHOT_URLS = [
  "https://github.com/aegishield/aegis-gorgon",
  "https://en.wikipedia.org/wiki/Phishing",
  "https://shop.example.co.uk/account/login",
  "http://10.0.0.1/account/verify",
  "http://paypal.com@evil.example/login?next=http://attacker.tld/steal",
  "https://example.com/r?to=https://attacker.example/login",
  "https://paypa1.example/account/verify",
  "https://xn--80ak6aa92e.com/",
  "https://www.paypal.com/account/recover",
  "https://api.example.dev/v1/users",
  "https://promo.top/free-stuff",
  "https://invoice.zip/file",
  "https://a.b.c.d.example.com/",
  "https://very-long-host.example.com/" + "x/".repeat(80),
] as const;

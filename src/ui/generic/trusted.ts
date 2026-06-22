/**
 * Builds a fast `isTrusted(url) → boolean` checker from a list of hostnames
 * or eTLD+1 entries. A URL is trusted if its hostname:
 *   - exactly matches an entry (case-insensitive), OR
 *   - is a subdomain of an entry — i.e. `hostname.endsWith("." + entry)`.
 *
 * The suffix-match form lets `"google.com"` cover `mail.google.com` and
 * `drive.google.com` without bundling `tldts` into every content script.
 *
 * Invalid URLs (anything `new URL()` rejects) are never trusted.
 */
export function makeIsTrusted(entries: readonly string[]): (url: string) => boolean {
  const normalized = entries
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
  return (url: string) => {
    let host: string;
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      return false;
    }
    for (const entry of normalized) {
      if (host === entry) return true;
      if (host.endsWith("." + entry)) return true;
    }
    return false;
  };
}

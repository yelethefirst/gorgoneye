/**
 * Implements the Safe Browsing v4 URL canonicalization steps.
 * Reference: https://developers.google.com/safe-browsing/v4/urls-hashing#canonicalization
 *
 * This is a pragmatic implementation covering the most common steps:
 *   - Strip tab/CR/LF and surrounding whitespace.
 *   - Drop the fragment.
 *   - Lowercase scheme and host.
 *   - Trim leading/trailing dots and collapse consecutive dots in the host.
 *   - Collapse consecutive slashes in the path and resolve `.` / `..` segments.
 *   - Percent-escape characters outside [0x21, 0x7E], plus `#` and `%`.
 *
 * Limitations:
 *   - Recursive percent-decoding of the host is NOT performed (rare in practice).
 *   - Non-IP hosts that look numeric are not normalized to dotted decimal.
 *   - Sufficient for demo and unit testing; production hardening can layer on top.
 */
const SAFE_BYTES = (() => {
  const set = new Set<number>();
  // Allowed: printable ASCII except `#` (0x23) and `%` (0x25).
  for (let b = 0x21; b <= 0x7e; b += 1) set.add(b);
  set.delete(0x23);
  set.delete(0x25);
  return set;
})();

function safeDecodeOnce(input: string): string {
  try {
    return decodeURIComponent(input);
  } catch {
    return input;
  }
}

function percentEscape(input: string): string {
  // Spec: repeatedly percent-decode the input until no encoding remains, then
  // re-escape characters outside [0x21, 0x7E] plus `#` and `%`. The loop is
  // bounded to avoid pathological inputs that would never stabilize.
  let decoded = input;
  for (let i = 0; i < 8; i += 1) {
    const next = safeDecodeOnce(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  const bytes = new TextEncoder().encode(decoded);
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i]!;
    if (SAFE_BYTES.has(b)) {
      out += String.fromCharCode(b);
    } else {
      out += `%${b.toString(16).toUpperCase().padStart(2, "0")}`;
    }
  }
  return out;
}

function resolveDotSegments(path: string): string {
  // RFC 3986 section 5.2.4 simplified for absolute paths.
  const segments = path.split("/");
  const out: string[] = [];
  for (const seg of segments) {
    if (seg === "" || seg === ".") {
      // Preserve a trailing empty segment so /a/ stays /a/.
      continue;
    }
    if (seg === "..") {
      out.pop();
      continue;
    }
    out.push(seg);
  }
  let result = "/" + out.join("/");
  if (path.endsWith("/") && !result.endsWith("/")) result += "/";
  return result;
}

export function canonicalizeForSafeBrowsing(rawUrl: string): string | null {
  // 1. Drop tab/CR/LF and surrounding whitespace.
  const cleaned = rawUrl.replace(/[\t\r\n]+/g, "").trim();
  if (!cleaned) return null;

  // 2. Parse. Only http(s) are addressable in Safe Browsing.
  let url: URL;
  try {
    url = new URL(cleaned);
  } catch {
    return null;
  }
  const scheme = url.protocol.slice(0, -1).toLowerCase();
  if (scheme !== "http" && scheme !== "https") return null;

  // 3. Host: lowercase, trim dots, collapse repeated dots.
  let host = url.hostname.toLowerCase();
  host = host.replace(/^\.+|\.+$/g, "").replace(/\.+/g, ".");
  if (host === "") return null;

  // 4. Path: collapse slashes, resolve dot segments.
  let path = url.pathname || "/";
  path = path.replace(/\/{2,}/g, "/");
  path = resolveDotSegments(path);

  // 5. Percent-escape path and query (fragment dropped).
  path = percentEscape(path);
  const query = url.search ? `?${percentEscape(url.search.slice(1))}` : "";
  const portPart = url.port ? `:${url.port}` : "";

  return `${scheme}://${host}${portPart}${path}${query}`;
}

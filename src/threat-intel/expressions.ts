/**
 * Generates the Safe Browsing "URL expressions" to hash and look up.
 * Reference: https://developers.google.com/safe-browsing/v4/urls-hashing#suffixprefix-expressions
 *
 * For a canonical URL like "https://a.b.example.com/1/2.html?p=1" we generate
 * combinations of:
 *   - host suffixes: exact, then drop leading labels one at a time, up to 4 extra
 *   - path prefixes: exact + query, exact, parent paths, "/"
 * Capped at 30 total expressions per Safe Browsing spec.
 */
const MAX_EXPRESSIONS = 30;
const MAX_HOST_SUFFIXES = 5; // exact + 4 suffixes
const MAX_PATH_PREFIXES = 6;

function hostSuffixes(host: string): string[] {
  const labels = host.split(".").filter(Boolean);
  if (labels.length <= 2) return [host];
  const out: string[] = [host];
  for (let i = 1; i < labels.length - 1 && out.length < MAX_HOST_SUFFIXES; i += 1) {
    out.push(labels.slice(i).join("."));
  }
  return out;
}

function pathPrefixes(path: string, query: string): string[] {
  const out: string[] = [];
  const exact = path + query;
  out.push(exact);
  if (query) out.push(path);
  // Strip trailing components.
  let trimmed = path;
  while (trimmed.length > 1 && out.length < MAX_PATH_PREFIXES) {
    const idx = trimmed.lastIndexOf("/", trimmed.length - 2);
    if (idx <= 0) break;
    trimmed = trimmed.slice(0, idx + 1);
    if (!out.includes(trimmed)) out.push(trimmed);
  }
  if (!out.includes("/")) out.push("/");
  return out.slice(0, MAX_PATH_PREFIXES);
}

export function enumerateUrlExpressions(canonicalUrl: string): string[] {
  let url: URL;
  try {
    url = new URL(canonicalUrl);
  } catch {
    return [];
  }
  const host = url.hostname;
  const path = url.pathname || "/";
  const query = url.search;
  const port = url.port ? `:${url.port}` : "";

  const out = new Set<string>();
  for (const h of hostSuffixes(host)) {
    for (const p of pathPrefixes(path, query)) {
      out.add(`${h}${port}${p}`);
      if (out.size >= MAX_EXPRESSIONS) return Array.from(out);
    }
  }
  return Array.from(out);
}

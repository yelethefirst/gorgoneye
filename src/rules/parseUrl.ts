import { parse as tldtsParse } from "tldts";
import type { ParsedUrl, ParseErrorReason } from "../shared/parsedUrl";

const HIERARCHICAL_SCHEMES = new Set(["http", "https", "ftp", "ws", "wss", "file"]);
const NON_HIERARCHICAL_SCHEMES = new Set(["javascript", "data", "mailto", "tel", "blob"]);

const DEFAULT_PORTS: Record<string, string> = {
  http: "80",
  https: "443",
  ws: "80",
  wss: "443",
  ftp: "21",
};

export function parseUrl(rawUrl: unknown): ParsedUrl {
  if (typeof rawUrl !== "string") {
    return errorResult(String(rawUrl ?? ""), "non_string_input");
  }
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    return errorResult(rawUrl, "empty_input");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return errorResult(trimmed, "invalid_url");
  }

  const scheme = stripTrailingColon(url.protocol).toLowerCase();

  if (NON_HIERARCHICAL_SCHEMES.has(scheme)) {
    return {
      originalUrl: trimmed,
      canonicalUrl: `${scheme}:${nonHierarchicalPayload(trimmed)}`,
      scheme,
      hostname: null,
      port: null,
      path: nonHierarchicalPayload(trimmed),
      query: "",
      fragment: "",
      registrableDomain: null,
      publicSuffix: null,
      subdomain: null,
      isIpAddress: false,
      isIdn: false,
      isPunycode: false,
    };
  }

  const hostnameRaw = url.hostname || "";
  const hostname = hostnameRaw ? hostnameRaw.toLowerCase() : null;
  const port = url.port || null;
  const path = url.pathname || "/";
  const query = url.search ? url.search.slice(1) : "";
  const fragment = url.hash ? url.hash.slice(1) : "";

  const tld = hostname ? tldtsParse(hostname, { allowPrivateDomains: false }) : null;
  const isIp = Boolean(tld?.isIp) || isBracketedIpv6(hostnameRaw);
  const registrableDomain = isIp ? null : (tld?.domain ?? null);
  const publicSuffix = isIp ? null : (tld?.publicSuffix ?? null);
  const subdomain = isIp ? null : (tld?.subdomain ?? null);
  const isPunycode = !isIp && containsPunycodeLabel(hostname);
  const isIdn = !isIp && (isPunycode || hasNonAscii(hostnameRaw));

  const canonicalUrl = canonicalize({ scheme, hostname, port, path, query });

  return {
    originalUrl: trimmed,
    canonicalUrl,
    scheme,
    hostname,
    port,
    path,
    query,
    fragment,
    registrableDomain,
    publicSuffix,
    subdomain: subdomain && subdomain.length > 0 ? subdomain : null,
    isIpAddress: isIp,
    isIdn,
    isPunycode,
  };
}

function errorResult(rawUrl: string, reason: ParseErrorReason): ParsedUrl {
  return {
    originalUrl: rawUrl,
    canonicalUrl: rawUrl,
    scheme: "",
    hostname: null,
    port: null,
    path: "",
    query: "",
    fragment: "",
    registrableDomain: null,
    publicSuffix: null,
    subdomain: null,
    isIpAddress: false,
    isIdn: false,
    isPunycode: false,
    parseError: reason,
  };
}

interface CanonicalParts {
  scheme: string;
  hostname: string | null;
  port: string | null;
  path: string;
  query: string;
}

function canonicalize({ scheme, hostname, port, path, query }: CanonicalParts): string {
  if (!hostname) {
    return `${scheme}:${path}${query ? `?${query}` : ""}`;
  }
  const host = formatHost(hostname);
  const portPart = port && DEFAULT_PORTS[scheme] !== port ? `:${port}` : "";
  const normalizedPath = path || "/";
  return `${scheme}://${host}${portPart}${normalizedPath}${query ? `?${query}` : ""}`;
}

function formatHost(hostname: string): string {
  if (hostname.startsWith("[") && hostname.endsWith("]")) return hostname;
  // The URL parser may strip IPv6 brackets in some shapes; restore if it parses as IPv6.
  if (hostname.includes(":") && !hostname.includes(".")) return `[${hostname}]`;
  return hostname;
}

function stripTrailingColon(protocol: string): string {
  return protocol.endsWith(":") ? protocol.slice(0, -1) : protocol;
}

function nonHierarchicalPayload(rawUrl: string): string {
  const colonIdx = rawUrl.indexOf(":");
  return colonIdx >= 0 ? rawUrl.slice(colonIdx + 1) : rawUrl;
}

function isBracketedIpv6(hostnameRaw: string): boolean {
  return hostnameRaw.startsWith("[") && hostnameRaw.endsWith("]");
}

function containsPunycodeLabel(hostname: string | null): boolean {
  if (!hostname) return false;
  return hostname
    .split(".")
    .some((label) => label.startsWith("xn--"));
}

function hasNonAscii(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) > 127) return true;
  }
  return false;
}

// Re-export for downstream consumers.
export { HIERARCHICAL_SCHEMES, NON_HIERARCHICAL_SCHEMES };

export interface ParsedUrl {
  originalUrl: string;
  canonicalUrl: string;
  scheme: string;
  hostname: string | null;
  port: string | null;
  path: string;
  query: string;
  fragment: string;
  registrableDomain: string | null;
  publicSuffix: string | null;
  subdomain: string | null;
  isIpAddress: boolean;
  isIdn: boolean;
  isPunycode: boolean;
  parseError?: string;
}

export type ParseErrorReason =
  | "empty_input"
  | "non_string_input"
  | "invalid_url"
  | "unsupported_scheme";

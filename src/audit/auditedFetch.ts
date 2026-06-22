import type {
  AuditDataCategory,
  AuditMethod,
  AuditPurpose,
  AuditRecord,
} from "../shared/audit";
import { newId } from "../shared/ids";
import type { AuditStore } from "./auditStore";

export interface AuditedFetchInit {
  url: string;
  method?: AuditMethod;
  /** Pre-encoded request body. JSON callers must stringify before calling. */
  body?: string | Uint8Array;
  headers?: Record<string, string>;
  purpose: AuditPurpose;
  dataCategory: AuditDataCategory;
  /**
   * True iff the call legitimately carries a full scanned URL. Setting this
   * silences the URL-in-body guard. Only valid when the dataCategory is
   * "target_origin_request" (consented visual inspection) — every other
   * combination throws.
   */
  containsFullScannedUrl?: boolean;
  /** True iff the call was initiated by explicit user consent. */
  userConsented?: boolean;
  /**
   * Test mode: when present, the wrapper does NOT execute fetch. It records
   * the would-be call and returns the supplied mock response. Used by the
   * privacy verifier (AEG-10-3) to inspect outbound payload shape without
   * actually contacting third parties.
   */
  testMode?: { status: number; body: string };
}

export interface AuditedFetchResult {
  recordId: string;
  status: number;
  bodyText: string;
}

const URL_IN_BODY_RE = /https?:\/\//i;

function destinationHostname(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname;
  } catch {
    return "<invalid-url>";
  }
}

function byteLength(body?: string | Uint8Array): number {
  if (!body) return 0;
  if (typeof body === "string") return new TextEncoder().encode(body).length;
  return body.length;
}

function bodyContainsUrl(body?: string | Uint8Array): boolean {
  if (!body) return false;
  const text = typeof body === "string" ? body : new TextDecoder().decode(body);
  return URL_IN_BODY_RE.test(text);
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface AuditedFetchOptions {
  store: AuditStore;
  fetchImpl?: FetchLike;
  now?: () => number;
  onRecord?: (record: AuditRecord) => void;
}

/**
 * Centralized, audited HTTP wrapper. Every outbound extension request must go
 * through this function so that:
 *   - The destination, purpose, byte counts, and data category are recorded.
 *   - Email content is structurally impossible to pass through (no field exists).
 *   - Full scanned URLs are rejected from request bodies unless the caller is
 *     a target-origin inspection with explicit user consent.
 *   - The privacy verifier can swap in a test mode that captures the payload
 *     without actually performing network I/O.
 */
export async function auditedFetch(
  init: AuditedFetchInit,
  opts: AuditedFetchOptions,
): Promise<AuditedFetchResult> {
  const method = init.method ?? "GET";
  const userConsented = init.userConsented ?? false;
  const containsFullScannedUrl = init.containsFullScannedUrl ?? false;

  // Body-policy guard. Layered to give precise error messages.
  if (containsFullScannedUrl) {
    if (init.dataCategory !== "target_origin_request") {
      throw new Error(
        `auditedFetch: containsFullScannedUrl=true requires dataCategory="target_origin_request" (got "${init.dataCategory}")`,
      );
    }
    if (!userConsented) {
      throw new Error(
        "auditedFetch: containsFullScannedUrl=true requires explicit user consent (userConsented=true).",
      );
    }
  } else if (bodyContainsUrl(init.body)) {
    throw new Error(
      "auditedFetch: request body appears to contain a URL but containsFullScannedUrl was not set. " +
        "If this is a consented target-origin inspection, set containsFullScannedUrl + dataCategory=target_origin_request.",
    );
  }

  const now = opts.now ?? Date.now;
  const recordId = newId("audit");
  const requestBytes = byteLength(init.body) + new TextEncoder().encode(init.url).length;

  let status: number | undefined;
  let bodyText = "";
  let fetchError: unknown;

  if (init.testMode) {
    status = init.testMode.status;
    bodyText = init.testMode.body;
  } else {
    const fetchImpl = opts.fetchImpl ?? globalThis.fetch?.bind(globalThis);
    if (!fetchImpl) {
      throw new Error("auditedFetch: no fetch implementation available in this runtime.");
    }
    try {
      const response = await fetchImpl(init.url, {
        method,
        headers: init.headers,
        body: init.body as BodyInit | undefined,
      });
      status = response.status;
      bodyText = await response.text();
    } catch (err) {
      fetchError = err;
    }
  }

  const record: AuditRecord = {
    id: recordId,
    timestamp: new Date(now()).toISOString(),
    destinationHostname: destinationHostname(init.url),
    method,
    purpose: init.purpose,
    dataCategory: init.dataCategory,
    requestBytes,
    ...(status !== undefined ? { responseBytes: byteLength(bodyText), status } : {}),
    containsEmailContent: false,
    containsFullScannedUrl,
    userConsented,
  };

  await opts.store.put(record);
  opts.onRecord?.(record);

  if (fetchError) {
    const err = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
    (err as Error & { auditRecordId?: string }).auditRecordId = recordId;
    throw err;
  }

  return { recordId, status: status!, bodyText };
}

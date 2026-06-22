export type AuditPurpose =
  | "safe_browsing_update"
  | "safe_browsing_full_hash"
  | "model_download"
  | "visual_inspection_target_origin"
  | "telemetry_opt_in"
  | "demo_fixture";

export type AuditDataCategory =
  | "hash_prefix"
  | "model_asset"
  | "target_origin_request"
  | "scrubbed_telemetry"
  | "fixture";

export type AuditMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface AuditRecord {
  id: string;
  timestamp: string;
  destinationHostname: string;
  method: AuditMethod;
  purpose: AuditPurpose;
  dataCategory: AuditDataCategory;
  requestBytes: number;
  responseBytes?: number;
  status?: number;
  /** Hard contract: audited calls MUST NOT carry email content. */
  containsEmailContent: false;
  /** True iff the call legitimately carries a full scanned URL (e.g., consented visual inspection). */
  containsFullScannedUrl: boolean;
  /** True iff the call was initiated by an explicit user consent action. */
  userConsented: boolean;
}

import type { AnalysisResult, ExplanationResult, UrlContext } from "./verdict";
import type { AuditRecord } from "./audit";
import type { UserSettings } from "../storage/settings";
import type { PrivacyVerificationReport } from "../privacy/verifier";
import type { TrainingProgress } from "./training";
import type { TrainingCard } from "../ui/popup/buildTrainingCard";

export interface AnalyzeUrlRequest {
  type: "ANALYZE_URL";
  requestId: string;
  url: string;
  context: UrlContext;
  /**
   * Optional raw header text (RFC 5322) for the email the link came from.
   * When the Gmail content script is viewing a "Show original" page it pulls
   * this from the rendered `<pre>` and forwards it; in normal Gmail view it
   * is omitted and the header layer reports `not_available`.
   */
  emailHeaderText?: string;
}

export interface AnalyzeUrlResult {
  type: "ANALYZE_URL_RESULT";
  requestId: string;
  result: AnalysisResult;
}

export interface GetVerdictRequest {
  type: "GET_VERDICT";
  requestId: string;
  urlHash: string;
}

export interface GetVerdictResult {
  type: "GET_VERDICT_RESULT";
  requestId: string;
  result?: AnalysisResult;
}

export interface GetRecentVerdictsRequest {
  type: "GET_RECENT_VERDICTS";
  requestId: string;
  limit?: number;
}

export interface GetRecentVerdictsResult {
  type: "GET_RECENT_VERDICTS_RESULT";
  requestId: string;
  results: AnalysisResult[];
}

export interface GetSettingsRequest {
  type: "GET_SETTINGS";
  requestId: string;
}

export interface GetSettingsResult {
  type: "GET_SETTINGS_RESULT";
  requestId: string;
  settings: UserSettings;
}

export interface UpdateSettingsRequest {
  type: "UPDATE_SETTINGS";
  requestId: string;
  patch: Partial<UserSettings>;
}

export interface UpdateSettingsResult {
  type: "UPDATE_SETTINGS_RESULT";
  requestId: string;
  settings: UserSettings;
}

export interface GetAuditLogRequest {
  type: "GET_AUDIT_LOG";
  requestId: string;
  limit?: number;
}

export interface GetAuditLogResult {
  type: "GET_AUDIT_LOG_RESULT";
  requestId: string;
  records: AuditRecord[];
}

export interface ClearAuditLogRequest {
  type: "CLEAR_AUDIT_LOG";
  requestId: string;
}

export interface ClearAuditLogResult {
  type: "CLEAR_AUDIT_LOG_RESULT";
  requestId: string;
}

export interface ClearVerdictCacheRequest {
  type: "CLEAR_VERDICT_CACHE";
  requestId: string;
}

export interface ClearVerdictCacheResult {
  type: "CLEAR_VERDICT_CACHE_RESULT";
  requestId: string;
}

export interface GetTrainingProgressRequest {
  type: "GET_TRAINING_PROGRESS";
  requestId: string;
}

export interface GetTrainingProgressResult {
  type: "GET_TRAINING_PROGRESS_RESULT";
  requestId: string;
  progress: TrainingProgress;
}

export interface RecordTrainingAnswerRequest {
  type: "RECORD_TRAINING_ANSWER";
  requestId: string;
  correct: boolean;
}

export interface RecordTrainingAnswerResult {
  type: "RECORD_TRAINING_ANSWER_RESULT";
  requestId: string;
  progress: TrainingProgress;
}

export interface ResetTrainingProgressRequest {
  type: "RESET_TRAINING_PROGRESS";
  requestId: string;
}

export interface ResetTrainingProgressResult {
  type: "RESET_TRAINING_PROGRESS_RESULT";
  requestId: string;
  progress: TrainingProgress;
}

export interface RunPrivacyVerificationRequest {
  type: "RUN_PRIVACY_VERIFICATION";
  requestId: string;
}

export interface RunPrivacyVerificationResult {
  type: "RUN_PRIVACY_VERIFICATION_RESULT";
  requestId: string;
  report: PrivacyVerificationReport;
}

export interface InspectVisuallyRequest {
  type: "INSPECT_VISUALLY";
  requestId: string;
  analysisId: string;
  /** True iff the user explicitly consented in the ConsentPrompt. */
  consented: boolean;
}

export interface InspectVisuallyResult {
  type: "INSPECT_VISUALLY_RESULT";
  requestId: string;
  result: AnalysisResult;
}

export interface BuildLlmTrainingCardRequest {
  type: "BUILD_LLM_TRAINING_CARD";
  requestId: string;
  analysisId: string;
}

export interface BuildLlmTrainingCardResult {
  type: "BUILD_LLM_TRAINING_CARD_RESULT";
  requestId: string;
  /**
   * The card, or `null` when no card was produced (non-phishing verdict, or
   * LLM disabled AND template returned null). When the LLM path errored, the
   * card is the template fallback and `mode` is "template".
   */
  card: TrainingCard | null;
  mode: "local_llm" | "template";
}

export interface ExplainVerdictRequest {
  type: "EXPLAIN_VERDICT";
  requestId: string;
  analysisId: string;
  mode: "template" | "local_llm";
}

export interface CancelExplainVerdictRequest {
  type: "CANCEL_EXPLAIN_VERDICT";
  requestId: string;
  targetRequestId: string;
}

export interface CancelExplainVerdictResult {
  type: "CANCEL_EXPLAIN_VERDICT_RESULT";
  requestId: string;
  cancelled: boolean;
}

export interface ExplainVerdictProgress {
  type: "EXPLAIN_VERDICT_PROGRESS";
  requestId: string;
  phase: "loading" | "generating" | "fallback";
  message: string;
  progress?: number;
}

export interface ExplainVerdictChunk {
  type: "EXPLAIN_VERDICT_CHUNK";
  requestId: string;
  text: string;
  done: false;
}

export interface ExplainVerdictResult {
  type: "EXPLAIN_VERDICT_RESULT";
  requestId: string;
  explanation: ExplanationResult;
}

export interface AuditLogUpdated {
  type: "AUDIT_LOG_UPDATED";
  latestRecordId: string;
}

export interface ExtensionErrorResponse {
  type: "ERROR";
  requestId: string;
  code: ExtensionErrorCode;
  message: string;
}

export type ExtensionErrorCode = "UNKNOWN_MESSAGE_TYPE" | "INVALID_PAYLOAD" | "INTERNAL_ERROR";

export type ExtensionRequest =
  | AnalyzeUrlRequest
  | GetVerdictRequest
  | GetRecentVerdictsRequest
  | GetSettingsRequest
  | UpdateSettingsRequest
  | GetAuditLogRequest
  | ClearAuditLogRequest
  | ClearVerdictCacheRequest
  | GetTrainingProgressRequest
  | RecordTrainingAnswerRequest
  | ResetTrainingProgressRequest
  | RunPrivacyVerificationRequest
  | InspectVisuallyRequest
  | BuildLlmTrainingCardRequest
  | ExplainVerdictRequest
  | CancelExplainVerdictRequest;

export type ExtensionResponse =
  | AnalyzeUrlResult
  | GetVerdictResult
  | GetRecentVerdictsResult
  | GetSettingsResult
  | UpdateSettingsResult
  | GetAuditLogResult
  | ClearAuditLogResult
  | ClearVerdictCacheResult
  | GetTrainingProgressResult
  | RecordTrainingAnswerResult
  | ResetTrainingProgressResult
  | RunPrivacyVerificationResult
  | InspectVisuallyResult
  | BuildLlmTrainingCardResult
  | CancelExplainVerdictResult
  | ExplainVerdictProgress
  | ExplainVerdictChunk
  | ExplainVerdictResult
  | ExtensionErrorResponse;

export type ExtensionEvent = AuditLogUpdated;

export type ExtensionMessage = ExtensionRequest | ExtensionResponse | ExtensionEvent;

type ResponseFor<T extends ExtensionRequest> = T extends AnalyzeUrlRequest
  ? AnalyzeUrlResult
  : T extends GetVerdictRequest
    ? GetVerdictResult
    : T extends GetRecentVerdictsRequest
      ? GetRecentVerdictsResult
      : T extends GetSettingsRequest
        ? GetSettingsResult
        : T extends UpdateSettingsRequest
          ? UpdateSettingsResult
          : T extends GetAuditLogRequest
            ? GetAuditLogResult
            : T extends ClearAuditLogRequest
              ? ClearAuditLogResult
              : T extends ClearVerdictCacheRequest
                ? ClearVerdictCacheResult
                : T extends GetTrainingProgressRequest
                  ? GetTrainingProgressResult
                  : T extends RecordTrainingAnswerRequest
                    ? RecordTrainingAnswerResult
                    : T extends ResetTrainingProgressRequest
                      ? ResetTrainingProgressResult
                      : T extends RunPrivacyVerificationRequest
                        ? RunPrivacyVerificationResult
                        : T extends InspectVisuallyRequest
                          ? InspectVisuallyResult
                          : T extends BuildLlmTrainingCardRequest
                            ? BuildLlmTrainingCardResult
                            : T extends ExplainVerdictRequest
                              ? ExplainVerdictResult
                              : T extends CancelExplainVerdictRequest
                                ? CancelExplainVerdictResult
                                : never;

export type RequestResponse<T extends ExtensionRequest> = ResponseFor<T> | ExtensionErrorResponse;

export function isExtensionRequest(value: unknown): value is ExtensionRequest {
  if (!value || typeof value !== "object") return false;
  const v = value as { type?: unknown; requestId?: unknown };
  if (typeof v.requestId !== "string") return false;
  switch (v.type) {
    case "ANALYZE_URL":
    case "GET_VERDICT":
    case "GET_RECENT_VERDICTS":
    case "GET_SETTINGS":
    case "UPDATE_SETTINGS":
    case "GET_AUDIT_LOG":
    case "CLEAR_AUDIT_LOG":
    case "CLEAR_VERDICT_CACHE":
    case "GET_TRAINING_PROGRESS":
    case "RECORD_TRAINING_ANSWER":
    case "RESET_TRAINING_PROGRESS":
    case "RUN_PRIVACY_VERIFICATION":
    case "INSPECT_VISUALLY":
    case "BUILD_LLM_TRAINING_CARD":
    case "EXPLAIN_VERDICT":
    case "CANCEL_EXPLAIN_VERDICT":
      return true;
    default:
      return false;
  }
}

export function isExtensionResponse(value: unknown): value is ExtensionResponse {
  if (!value || typeof value !== "object") return false;
  const v = value as { type?: unknown };
  return (
    v.type === "ANALYZE_URL_RESULT" ||
    v.type === "GET_VERDICT_RESULT" ||
    v.type === "GET_RECENT_VERDICTS_RESULT" ||
    v.type === "GET_SETTINGS_RESULT" ||
    v.type === "UPDATE_SETTINGS_RESULT" ||
    v.type === "GET_AUDIT_LOG_RESULT" ||
    v.type === "CLEAR_AUDIT_LOG_RESULT" ||
    v.type === "CLEAR_VERDICT_CACHE_RESULT" ||
    v.type === "GET_TRAINING_PROGRESS_RESULT" ||
    v.type === "RECORD_TRAINING_ANSWER_RESULT" ||
    v.type === "RESET_TRAINING_PROGRESS_RESULT" ||
    v.type === "RUN_PRIVACY_VERIFICATION_RESULT" ||
    v.type === "INSPECT_VISUALLY_RESULT" ||
    v.type === "BUILD_LLM_TRAINING_CARD_RESULT" ||
    v.type === "CANCEL_EXPLAIN_VERDICT_RESULT" ||
    v.type === "EXPLAIN_VERDICT_PROGRESS" ||
    v.type === "EXPLAIN_VERDICT_CHUNK" ||
    v.type === "EXPLAIN_VERDICT_RESULT" ||
    v.type === "ERROR"
  );
}

export function makeErrorResponse(
  requestId: string,
  code: ExtensionErrorCode,
  message: string,
): ExtensionErrorResponse {
  return { type: "ERROR", requestId, code, message };
}

/**
 * Pure helpers for editing the trusted-domains list. Splitting these out of
 * the React panel lets us unit-test the validation and normalization without
 * a DOM.
 */

const VALID_RE = /^[a-z0-9.-]+$/;

export type AddError =
  | "empty"
  | "invalid_chars"
  | "no_dot"
  | "leading_or_trailing_dot"
  | "duplicate";

export interface AddOutcome {
  next: string[];
  error: AddError | null;
  added: string | null;
}

export function normalizeEntry(raw: string): string {
  return raw.trim().toLowerCase();
}

export function addTrustedDomain(
  current: readonly string[],
  raw: string,
): AddOutcome {
  const normalized = normalizeEntry(raw);
  if (!normalized) return { next: [...current], error: "empty", added: null };
  if (!VALID_RE.test(normalized)) {
    return { next: [...current], error: "invalid_chars", added: null };
  }
  if (!normalized.includes(".")) {
    return { next: [...current], error: "no_dot", added: null };
  }
  if (normalized.startsWith(".") || normalized.endsWith(".")) {
    return { next: [...current], error: "leading_or_trailing_dot", added: null };
  }
  if (current.includes(normalized)) {
    return { next: [...current], error: "duplicate", added: null };
  }
  return { next: [...current, normalized], error: null, added: normalized };
}

export function removeTrustedDomain(
  current: readonly string[],
  entry: string,
): string[] {
  return current.filter((e) => e !== entry);
}

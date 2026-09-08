/**
 * One reading of an API error, for every consumer (#192).
 *
 * A password-complexity rejection carries a summary plus the list of policy
 * rules that failed. Four call sites each unpacked that differently — one read
 * `data.detail.errors`, one read `data.errors[0].message`, two read only
 * `data.message` — so the same response rendered as a bullet list in one place,
 * a single rule in another, and "An unexpected error occurred" in a third.
 *
 * Everything now goes through `normalizeApiError`, which accepts each shape the
 * app can produce and returns the same pair. The axios interceptor in
 * `services/api.ts` normalizes most responses already; this handles what
 * reaches components through Redux, plus raw bodies that bypass the
 * interceptor.
 */

export interface NormalizedApiError {
  /** Always present — falls back to the caller's default. */
  message: string;
  /** Individual failures behind the summary. Usually the failed policy rules. */
  details: string[];
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;

const nonEmptyString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

/** Accepts `string[]`, `{message}[]`, or anything else (→ []). */
const readDetails = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === 'string') return nonEmptyString(entry);
      const record = asRecord(entry);
      return nonEmptyString(record?.message);
    })
    .filter((entry): entry is string => Boolean(entry));
};

export const normalizeApiError = (
  error: unknown,
  fallbackMessage = 'Something went wrong. Please try again.'
): NormalizedApiError => {
  const fromString = nonEmptyString(error);
  if (fromString) {
    return { message: fromString, details: [] };
  }

  // An axios error still wrapped — unwrap to the response body.
  const record = asRecord(error);
  if (!record) return { message: fallbackMessage, details: [] };

  const response = asRecord(record.response);
  const body = asRecord(response?.data) ?? record;

  // `detail` is FastAPI's own envelope, present when the interceptor did not
  // rewrite the body (or when a thunk stored the raw detail object).
  const detail = asRecord(body.detail);

  const message =
    nonEmptyString(body.message) ||
    nonEmptyString(detail?.message) ||
    nonEmptyString(body.detail) ||
    fallbackMessage;

  const details = [...readDetails(body.errors), ...readDetails(detail?.errors)];

  // The interceptor turns a lone string detail into a one-entry errors array;
  // repeating it under the summary reads as a stutter.
  const deduped = details.length === 1 && details[0] === message ? [] : details;

  return { message, details: deduped };
};

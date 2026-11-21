/**
 * The UseSense API address, accepted in either form.
 *
 * Integrators pass `apiBaseUrl` as `https://api.usesense.ai` or as
 * `https://api.usesense.ai/v1` (the SDK's entry points used to disagree on
 * which one they wanted; the wrong one 404s without CORS headers, which the
 * browser reports only as "Failed to fetch"). Every entry point normalises
 * through these two helpers, so both forms work everywhere.
 */

/** The production API, without the version segment. */
export const DEFAULT_API_ORIGIN = 'https://api.usesense.ai';

/**
 * The API address without a trailing `/v1` or slash, e.g.
 * `https://api.usesense.ai` or `https://proxy.example.com/usesense`.
 * Blank or missing input gives the production API.
 */
export function apiOrigin(apiBaseUrl?: string | null): string {
  const trimmed = (apiBaseUrl ?? '').trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_API_ORIGIN;
  return trimmed.replace(/\/v1$/i, '');
}

/** The versioned API root, e.g. `https://api.usesense.ai/v1`. */
export function apiV1Base(apiBaseUrl?: string | null): string {
  return `${apiOrigin(apiBaseUrl)}/v1`;
}

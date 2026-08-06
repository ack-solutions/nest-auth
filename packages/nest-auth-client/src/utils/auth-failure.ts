/**
 * Session-failure classification — the ONE rule the whole SDK agrees on.
 *
 * A session may only be ended by a DEFINITIVE rejection: the server answered the
 * request with `401` (or `403`). Everything else — the synthesised status `0`
 * (a network / adapter failure), a request timeout, `408`, `429`, all `5xx`, and
 * any other non-2xx — is INDETERMINATE: the client failed to get a definitive
 * answer, so it must NOT destroy tokens, must NOT emit logout, and must surface a
 * retryable error. Consumers read `error.kind` instead of re-deriving this from
 * status codes.
 */
export type AuthFailureKind =
    /** The server definitively rejected the request (401/403) — session is over. */
    | 'rejected'
    /** We could not get a definitive answer (network/timeout/429/5xx/…) — retry. */
    | 'indeterminate';

/**
 * Classify a failed auth request into `'rejected'` (401/403 only) or
 * `'indeterminate'` (everything else, including the synthesised network status 0).
 */
export function classifyAuthFailure(status: number | undefined | null): AuthFailureKind {
    return status === 401 || status === 403 ? 'rejected' : 'indeterminate';
}

/**
 * A user-friendly DEFAULT message for a failed request, used only when the
 * server did not send its own `message` (typically network / timeout / opaque
 * 5xx). Kept plain and actionable — no status codes, no jargon.
 */
export function defaultMessageForStatus(status: number | undefined | null): string {
    switch (true) {
        case status === 0:
            return 'Unable to reach the server. Check your internet connection and try again.';
        case status === 408:
            return 'The request timed out. Please try again.';
        case status === 429:
            return 'Too many attempts. Please wait a moment and try again.';
        case status === 401:
            return 'Your session has expired. Please sign in again.';
        case status === 403:
            return 'You don’t have permission to do that.';
        case typeof status === 'number' && status >= 500:
            return 'The server is temporarily unavailable. Please try again in a moment.';
        default:
            return 'Something went wrong. Please try again.';
    }
}

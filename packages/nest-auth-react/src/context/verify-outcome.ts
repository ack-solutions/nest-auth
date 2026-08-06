import type { AuthError, AuthStatus } from '@ackplus/nest-auth-client';

/**
 * The outcome of a `client.verifySession()` call, already reduced to the ONE
 * distinction that matters: was the session definitively rejected, or could we
 * simply not get a definitive answer?
 *
 * - `valid`         — the session is good.
 * - `rejected`      — the server definitively said no (401/403).
 * - `indeterminate` — we couldn't ask (network / timeout / 429 / 5xx).
 */
export type VerifyOutcome =
    | { type: 'valid' }
    | { type: 'rejected'; error?: AuthError | null }
    | { type: 'indeterminate'; error?: AuthError | null };

/**
 * Map a RESOLVED `client.verifySession()` result to an outcome. The client
 * returns `{ valid: false }` ONLY on a definitive rejection (401/403), so a
 * non-valid result is a rejection.
 */
export function verifyOutcomeFromResult(result: { valid?: boolean } | null | undefined): VerifyOutcome {
    if (result?.valid) return { type: 'valid' };
    // A concrete `valid: false` is the ONLY definitive rejection the client
    // returns. A missing/malformed result is NOT a rejection — default-preserve
    // (treat as indeterminate) so we never redirect on an ambiguous value.
    if (result && result.valid === false) return { type: 'rejected' };
    return { type: 'indeterminate', error: null };
}

/**
 * Map a THROWN `client.verifySession()` error to an outcome. Only an explicit
 * `kind: 'rejected'` is a definitive rejection; every other/unclassified error
 * (network, timeout, 429, 5xx) is indeterminate — so we never redirect to login
 * during a server outage.
 */
export function verifyOutcomeFromError(error: AuthError | null | undefined): VerifyOutcome {
    return error?.kind === 'rejected'
        ? { type: 'rejected', error }
        : { type: 'indeterminate', error: error ?? null };
}

/** What the provider should do in response to a verify outcome. */
export interface VerifyDecision {
    status: AuthStatus;
    /** Drop the local session + session data. */
    clearSession: boolean;
    /** Load the user profile (`getSessionData`). */
    loadProfile: boolean;
    /**
     * Invoke the app's `onUnauthenticated` callback — the one apps use to
     * redirect to login. This is the load-bearing bit: it must fire ONLY on a
     * definitive rejection, never during a server outage.
     */
    signalUnauthenticated: boolean;
    /** Error to expose via the provider's `error` state (`null` clears it). */
    error: AuthError | null;
}

/**
 * Decide what a `verifySession()` outcome means for the provider — the single
 * place that enforces "only a DEFINITIVE rejection (401/403) ends the session".
 *
 * - valid            → authenticated, load the profile.
 * - rejected (401/403) → unauthenticated, clear session, fire `onUnauthenticated`.
 * - indeterminate    → we couldn't ask (network / timeout / 429 / 5xx): keep the
 *   user exactly where they are, surface the error, and NEVER fire
 *   `onUnauthenticated`. The only status move is resolving the initial
 *   `'loading'` to `'unknown'` so the UI isn't stuck on a spinner forever.
 */
export function decideVerifyOutcome(outcome: VerifyOutcome, prevStatus: AuthStatus): VerifyDecision {
    switch (outcome.type) {
        case 'valid':
            return {
                status: 'authenticated',
                clearSession: false,
                loadProfile: true,
                signalUnauthenticated: false,
                error: null,
            };
        case 'rejected':
            return {
                status: 'unauthenticated',
                clearSession: true,
                loadProfile: false,
                signalUnauthenticated: true,
                error: outcome.error ?? null,
            };
        case 'indeterminate':
        default:
            // Do not log out, do not redirect.
            return {
                status: prevStatus === 'loading' ? 'unknown' : prevStatus,
                clearSession: false,
                loadProfile: false,
                signalUnauthenticated: false,
                error: outcome.error ?? null,
            };
    }
}

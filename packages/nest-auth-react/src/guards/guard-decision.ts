import type { AuthStatus } from '@ackplus/nest-auth-client';

/**
 * The render branch a guard should take.
 * - `children` — render the guarded content.
 * - `loading`  — render the loading fallback (also used for the UNKNOWN state).
 * - `deny`     — the "not allowed" branch (guard redirects via its callback, or
 *   renders its `fallback`).
 */
export type GuardOutcome = 'children' | 'loading' | 'deny';

export interface GuardDecision {
    outcome: GuardOutcome;
    /** Whether to invoke the guard's navigation callback (onUnauthenticated / onAuthenticated / onAccessDenied). */
    fireCallback: boolean;
}

export interface GuardAuthState {
    status: AuthStatus;
    /** Genuine loading (initial `'loading'` or a session-data fetch in flight). */
    isLoading: boolean;
}

/**
 * THE RULE, enforced in the guards: a guard may fire its redirect / access-denied
 * callback ONLY on a DEFINITIVE state — a user who is genuinely authenticated or
 * genuinely unauthenticated. The `'unknown'` status means a session check could
 * not be completed (server outage): we must NOT treat it as logged-out, must NOT
 * redirect to login, and must NOT deny access. It renders the loading fallback
 * (a neutral "still resolving" state) instead — the provider exposes `error` for
 * a retry UI.
 */

/** AuthGuard — requires a definitively authenticated user. */
export function decideAuthGuard({ status, isLoading }: GuardAuthState): GuardDecision {
    if (isLoading) return { outcome: 'loading', fireCallback: false };
    if (status === 'unknown') return { outcome: 'loading', fireCallback: false }; // indeterminate → NEVER redirect
    if (status === 'authenticated') return { outcome: 'children', fireCallback: false };
    return { outcome: 'deny', fireCallback: true }; // 'unauthenticated' (definitive)
}

/** GuestGuard — renders guest children only when definitively NOT authenticated. */
export function decideGuestGuard(
    { status, isLoading }: GuardAuthState,
    allowWhenAddingAccount = false,
): GuardDecision {
    if (isLoading) return { outcome: 'loading', fireCallback: false };
    if (allowWhenAddingAccount) return { outcome: 'children', fireCallback: false };
    if (status === 'unknown') return { outcome: 'loading', fireCallback: false }; // don't flash the login page at a maybe-authed user
    if (status === 'authenticated') return { outcome: 'deny', fireCallback: true }; // already authed → redirect / fallback
    return { outcome: 'children', fireCallback: false }; // guest
}

/** RequireRole / RequirePermission — requires authenticated AND holding the role/permission. */
export function decideAccessGuard({ status, isLoading }: GuardAuthState, hasAccess: boolean): GuardDecision {
    if (isLoading) return { outcome: 'loading', fireCallback: false };
    if (status === 'unknown') return { outcome: 'loading', fireCallback: false }; // can't determine access → don't deny
    const allowed = status === 'authenticated' && hasAccess;
    return allowed ? { outcome: 'children', fireCallback: false } : { outcome: 'deny', fireCallback: true };
}

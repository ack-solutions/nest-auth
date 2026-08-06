/**
 * The provider's mount-time session check must fire `onUnauthenticated` (which
 * apps use to redirect to login) ONLY on a DEFINITIVE rejection (401/403) —
 * never during a server outage (500 / network / timeout). The provider is pure
 * wiring over these three helpers, so testing them tests the behavior without a
 * DOM renderer (this package ships none).
 *
 * NO MOCKS — pure functions over real `AuthError` shapes.
 */
import { describe, it, expect } from 'vitest';
import type { AuthError, AuthStatus } from '@ackplus/nest-auth-client';
import {
    decideVerifyOutcome,
    verifyOutcomeFromResult,
    verifyOutcomeFromError,
} from '../../src/context/verify-outcome';

/** Reproduce exactly what the provider does with a verify result / thrown error. */
function signalsUnauthenticated(input: { result?: { valid?: boolean } } | { error: AuthError }, prev: AuthStatus = 'loading') {
    const outcome = 'error' in input ? verifyOutcomeFromError(input.error) : verifyOutcomeFromResult(input.result);
    return decideVerifyOutcome(outcome, prev);
}

const netError: AuthError = { message: 'Unable to reach the server.', statusCode: 0, kind: 'indeterminate' };
const serverError: AuthError = { message: 'temporarily unavailable', statusCode: 503, kind: 'indeterminate' };
const rejected401: AuthError = { message: 'session expired', statusCode: 401, kind: 'rejected' };

describe('mount verify decision — onUnauthenticated fires ONLY on definitive rejection', () => {
    it('does NOT signal unauthenticated when verify fails with a 5xx', () => {
        const d = signalsUnauthenticated({ error: serverError });
        expect(d.signalUnauthenticated).toBe(false);
        expect(d.clearSession).toBe(false);
        expect(d.error).toBe(serverError);
        expect(d.status).toBe('unknown'); // resolves initial 'loading', not 'unauthenticated'
    });

    it('does NOT signal unauthenticated on a network failure (status 0)', () => {
        const d = signalsUnauthenticated({ error: netError });
        expect(d.signalUnauthenticated).toBe(false);
        expect(d.clearSession).toBe(false);
    });

    it('does NOT signal unauthenticated for an unclassified error (defensive → indeterminate)', () => {
        const d = signalsUnauthenticated({ error: { message: 'weird', statusCode: 500 } as AuthError });
        expect(d.signalUnauthenticated).toBe(false);
        expect(d.clearSession).toBe(false);
    });

    it('indeterminate keeps the PREVIOUS status when it is not the initial loading', () => {
        const d = signalsUnauthenticated({ error: serverError }, 'authenticated');
        expect(d.status).toBe('authenticated'); // an authenticated user stays authenticated
        expect(d.signalUnauthenticated).toBe(false);
    });

    it('DOES signal unauthenticated on a definitive 401', () => {
        const d = signalsUnauthenticated({ error: rejected401 });
        expect(d.signalUnauthenticated).toBe(true);
        expect(d.clearSession).toBe(true);
        expect(d.status).toBe('unauthenticated');
    });

    it('DOES signal unauthenticated when verify returns { valid: false } (definitive)', () => {
        const d = signalsUnauthenticated({ result: { valid: false } });
        expect(d.signalUnauthenticated).toBe(true);
        expect(d.clearSession).toBe(true);
        expect(d.status).toBe('unauthenticated');
    });

    it('valid session → authenticated, load profile, no signal', () => {
        const d = signalsUnauthenticated({ result: { valid: true } });
        expect(d.signalUnauthenticated).toBe(false);
        expect(d.status).toBe('authenticated');
        expect(d.loadProfile).toBe(true);
    });
});

import { ServiceUnavailableException } from '@nestjs/common';
import { ERROR_CODES } from '../../auth.constants';

/**
 * The session store could not be reached.
 *
 * This is deliberately NOT an UnauthorizedException. "The store is down" and
 * "this session does not exist" are different facts, and collapsing them is a
 * fail-open: on a route with optional auth the guard treats a failed lookup as
 * "no session" and lets the request continue anonymously. A store outage must
 * fail CLOSED on every route.
 *
 * Surfaces as HTTP 503 with code `SESSION_STORE_UNAVAILABLE`. 503 (not 401) is
 * intentional: a client seeing 401 would sign the user out, so a brief Redis
 * blip would log out every user. 503 tells the client to retry.
 */
export class SessionStoreUnavailableError extends ServiceUnavailableException {
    /** The underlying driver error, when there was one. */
    readonly storeError?: unknown;

    constructor(storeError?: unknown) {
        super({
            message: 'Session store is unavailable',
            code: ERROR_CODES.SESSION_STORE_UNAVAILABLE,
        });
        this.storeError = storeError;
    }
}

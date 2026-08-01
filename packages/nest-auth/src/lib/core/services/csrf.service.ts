import { ForbiddenException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Request, Response } from 'express';
import { AuthConfigService } from './auth-config.service';
import { CookieHelper, CookieOptions } from '../../utils/cookie.helper';
import { compareKeys } from '../../utils/security.util';
import { CSRF_COOKIE_NAME, ERROR_CODES } from '../../auth.constants';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection for COOKIE-authenticated, state-changing requests.
 *
 * Cookie auth is ambient — the browser attaches the session cookie to any request
 * a malicious page triggers — so a state-changing request needs proof it came from
 * your own app. Bearer/header auth is immune (an attacker can't set the header
 * cross-site), so the guards only invoke this for cookie-sourced auth.
 *
 * Defense = a double-submit token (the primary check: a non-httpOnly cookie the
 * SPA reads and echoes in a header; an attacker can't read the victim's cookie to
 * forge the match) plus an optional Origin/Referer allowlist.
 */
@Injectable()
export class CsrfService {
    private cfg() {
        return AuthConfigService.getOptions().security?.csrf;
    }

    isEnabled(): boolean {
        return this.cfg()?.enabled === true;
    }

    cookieName(): string {
        return this.cfg()?.cookieName || CSRF_COOKIE_NAME;
    }

    headerName(): string {
        return (this.cfg()?.headerName || 'x-csrf-token').toLowerCase();
    }

    /** A fresh, high-entropy, URL-safe CSRF token. */
    generateToken(): string {
        return randomBytes(32).toString('base64url');
    }

    /**
     * Set (rotate) the double-submit cookie and return the token. Non-httpOnly so
     * the SPA can read it; inherits the app's cookie security flags. No-op result
     * value aside, callers should only invoke this when CSRF is enabled.
     */
    issue(res: Response, baseOptions?: CookieOptions): string {
        const token = this.generateToken();
        CookieHelper.set(res, this.cookieName(), token, {
            ...baseOptions,
            httpOnly: false, // MUST be readable by the SPA to be echoed back
        });
        return token;
    }

    /**
     * Validate a state-changing request authenticated by COOKIE. No-op for safe
     * methods or when CSRF is disabled. Throws `ForbiddenException` on failure.
     */
    assertValidForCookieAuth(req: Request): void {
        if (!this.isEnabled()) return;
        const method = (req.method || 'GET').toUpperCase();
        if (SAFE_METHODS.has(method)) return;

        // 1) Origin / Referer allowlist (defense in depth). Only enforced when an
        // allowlist is configured AND an origin can be derived — so clients that
        // legitimately omit Origin still pass via the double-submit token below,
        // while a cross-site browser POST (which always carries Origin) is caught.
        const allowed = this.cfg()?.allowedOrigins;
        if (Array.isArray(allowed) && allowed.length > 0) {
            const origin = this.requestOrigin(req);
            if (origin && !allowed.includes(origin)) {
                throw new ForbiddenException({
                    message: 'Cross-site request blocked (origin not allowed).',
                    code: ERROR_CODES.CSRF_ORIGIN_REJECTED,
                });
            }
        }

        // 2) Double-submit token (primary): the header must match the cookie.
        const cookieToken = CookieHelper.get(req, this.cookieName());
        const raw = req.headers[this.headerName()];
        const headerToken = Array.isArray(raw) ? raw[0] : raw;
        if (!cookieToken || !headerToken || !compareKeys(headerToken, cookieToken)) {
            throw new ForbiddenException({
                message: 'Invalid or missing CSRF token.',
                code: ERROR_CODES.CSRF_TOKEN_INVALID,
            });
        }
    }

    private requestOrigin(req: Request): string | undefined {
        const origin = req.headers.origin;
        if (typeof origin === 'string' && origin) return origin;
        const referer = req.headers.referer;
        if (typeof referer === 'string' && referer) {
            try {
                const u = new URL(referer);
                return `${u.protocol}//${u.host}`;
            } catch {
                return undefined;
            }
        }
        return undefined;
    }
}

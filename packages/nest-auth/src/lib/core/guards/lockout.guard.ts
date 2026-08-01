import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LockoutService } from '../services/lockout.service';
import { LOCKOUT_KEY, ERROR_CODES } from '../../auth.constants';

/**
 * Pre-check for the login route: reject an identifier+IP that is currently
 * locked (see LockoutService) with 429 + Retry-After. No-op unless
 * `security.lockout.enabled`. Failure counting happens off events, not here.
 */
@Injectable()
export class LockoutGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly lockout: LockoutService,
    ) { }

    canActivate(context: ExecutionContext): boolean {
        const marked = this.reflector.getAllAndOverride<boolean>(LOCKOUT_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!marked || !this.lockout.isEnabled()) return true;

        const http = context.switchToHttp();
        const req: any = http.getRequest();
        const res: any = http.getResponse();

        const body = req?.body ?? {};
        const identifier: string | undefined =
            body.credentials?.email ?? body.credentials?.phone ?? body.email ?? body.phone ?? body.identifier;

        const { locked, retryAfter } = this.lockout.check(identifier, req?.ip);
        if (locked) {
            if (res && typeof res.setHeader === 'function') res.setHeader('Retry-After', String(retryAfter));
            throw new HttpException(
                {
                    message: 'Account temporarily locked after too many failed attempts. Please try again later.',
                    code: ERROR_CODES.ACCOUNT_LOCKED,
                    retryAfter,
                },
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }
        return true;
    }
}

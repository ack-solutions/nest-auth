import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitService } from '../services/rate-limit.service';
import { RATE_LIMIT_BUCKET_KEY } from '../../auth.constants';
import { RateLimitBucket } from '../interfaces/rate-limit.interface';

/**
 * Enforces the rate-limit bucket a route was tagged with via `@RateLimit(...)`.
 * No-op unless `security.rateLimit.enabled`. Runs before the auth guard, so it
 * throttles unauthenticated endpoints (login/signup/forgot-password) too.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly rateLimit: RateLimitService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const bucket = this.reflector.getAllAndOverride<RateLimitBucket | undefined>(
            RATE_LIMIT_BUCKET_KEY,
            [context.getHandler(), context.getClass()],
        );
        if (!bucket) return true;

        const http = context.switchToHttp();
        await this.rateLimit.enforce(bucket, http.getRequest(), http.getResponse());
        return true;
    }
}

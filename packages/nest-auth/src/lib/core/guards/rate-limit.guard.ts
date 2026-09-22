import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitService } from '../services/rate-limit.service';
import { RATE_LIMIT_BUCKET_KEY } from '../../auth.constants';
import { RateLimitBucket } from '../interfaces/rate-limit.interface';

/**
 * Request-scoped stamp of buckets already counted, so registering the guard
 * twice (`@RateLimit()` already carries `UseGuards(RateLimitGuard)`; listing it
 * again in a controller's own `@UseGuards(...)` makes Nest run it twice) cannot
 * double-increment a bucket and silently halve every configured limit.
 */
const COUNTED_BUCKETS = Symbol('nestAuthRateLimitCountedBuckets');

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
        const request = http.getRequest();

        // Idempotent per request: count each bucket at most once, no matter how
        // many times the guard ended up registered for the route.
        const counted: Set<string> = (request[COUNTED_BUCKETS] ??= new Set<string>());
        if (counted.has(bucket)) return true;

        await this.rateLimit.enforce(bucket, request, http.getResponse());
        counted.add(bucket);
        return true;
    }
}

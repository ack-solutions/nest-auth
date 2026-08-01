import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { RATE_LIMIT_BUCKET_KEY } from '../../auth.constants';
import { RateLimitBucket } from '../interfaces/rate-limit.interface';

/**
 * Tag a route with a named rate-limit bucket and attach the RateLimitGuard.
 * A no-op unless `security.rateLimit.enabled` is set by the consumer.
 *
 * @example
 * ```ts
 * @Post('login')
 * @RateLimit('login')
 * login() { ... }
 * ```
 */
export function RateLimit(bucket: RateLimitBucket) {
    return applyDecorators(
        SetMetadata(RATE_LIMIT_BUCKET_KEY, bucket),
        UseGuards(RateLimitGuard),
    );
}

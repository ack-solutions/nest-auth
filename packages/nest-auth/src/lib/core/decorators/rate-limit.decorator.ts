import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { RATE_LIMIT_BUCKET_KEY } from '../../auth.constants';
import { RateLimitBucketName } from '../interfaces/rate-limit.interface';

/**
 * Tag a route with a named rate-limit bucket and attach the RateLimitGuard.
 * A no-op unless `security.rateLimit.enabled` is set by the consumer.
 *
 * `bucket` is a built-in name or one your app declares in
 * `security.rateLimit.buckets`; a name that is neither fails at boot. Each name
 * has its own counter, so give your own routes their own bucket rather than
 * borrowing a built-in one.
 *
 * @example
 * ```ts
 * @Post('login')
 * @RateLimit('login')
 * login() { ... }
 *
 * // security.rateLimit.buckets: { lookup: { windowMs: 60_000, max: 20 } }
 * @Post('lookup')
 * @RateLimit('lookup')
 * lookup() { ... }
 * ```
 */
export function RateLimit(bucket: RateLimitBucketName) {
    return applyDecorators(
        SetMetadata(RATE_LIMIT_BUCKET_KEY, bucket),
        UseGuards(RateLimitGuard),
    );
}

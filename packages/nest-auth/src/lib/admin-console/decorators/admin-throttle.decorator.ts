import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { RateLimitBucket } from '../../core/interfaces/rate-limit.interface';
import { AdminBruteForceGuard } from '../guards/admin-brute-force.guard';

export const ADMIN_THROTTLE_BUCKET = 'nest_auth_admin_throttle_bucket';

/**
 * Tag an admin-console auth route with an always-on brute-force throttle bucket.
 * Unlike `@RateLimit`, this enforces REGARDLESS of `security.rateLimit.enabled` —
 * the admin console is throttled by default. Disable via
 * `adminConsole.bruteForce.enabled: false`.
 */
export function AdminThrottle(bucket: RateLimitBucket) {
  return applyDecorators(
    SetMetadata(ADMIN_THROTTLE_BUCKET, bucket),
    UseGuards(AdminBruteForceGuard),
  );
}

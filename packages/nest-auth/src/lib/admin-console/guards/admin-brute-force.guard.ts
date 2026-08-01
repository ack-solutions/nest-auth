import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitService } from '../../core/services/rate-limit.service';
import { RateLimitBucket } from '../../core/interfaces/rate-limit.interface';
import { AdminConsoleConfigService } from '../services/admin-console-config.service';
import { ADMIN_THROTTLE_BUCKET } from '../decorators/admin-throttle.decorator';

/**
 * Always-on brute-force throttle for the admin-console auth endpoints (login and
 * the secret-key-gated signup/reset). Enforces the tagged bucket via
 * {@link RateLimitService.enforceAlways} — i.e. REGARDLESS of
 * `security.rateLimit.enabled` — unless the operator has explicitly opted out
 * with `adminConsole.bruteForce.enabled: false`.
 */
@Injectable()
export class AdminBruteForceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimit: RateLimitService,
    private readonly config: AdminConsoleConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const bucket = this.reflector.getAllAndOverride<RateLimitBucket | undefined>(
      ADMIN_THROTTLE_BUCKET,
      [context.getHandler(), context.getClass()],
    );
    if (!bucket) return true;
    if (!this.config.bruteForceProtectionEnabled()) return true;

    const http = context.switchToHttp();
    await this.rateLimit.enforceAlways(bucket, http.getRequest(), http.getResponse());
    return true;
  }
}

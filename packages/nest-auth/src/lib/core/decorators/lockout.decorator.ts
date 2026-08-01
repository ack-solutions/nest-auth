import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { LockoutGuard } from '../guards/lockout.guard';
import { LOCKOUT_KEY } from '../../auth.constants';

/**
 * `@Lockout()` — pre-checks the soft account-lockout on a route (the login
 * route). A no-op unless `security.lockout.enabled`.
 */
export function Lockout() {
    return applyDecorators(SetMetadata(LOCKOUT_KEY, true), UseGuards(LockoutGuard));
}

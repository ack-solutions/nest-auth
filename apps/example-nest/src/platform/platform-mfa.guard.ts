import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { RequestContext } from '@ackplus/nest-auth';
import { platformOptions } from './platform.constants';

/**
 * Enforces the configurable "platform admins must have MFA" policy.
 *
 * Runs AFTER the auth + role guard, so the user is already an authenticated
 * platform admin. When `requireMfa` is on, the admin must have MFA enabled on
 * their account (and because MFA is enabled, their login already passed the MFA
 * challenge — so a valid token implies an MFA-verified session).
 *
 * Reads the policy at request time, so it can be toggled per deployment without
 * a rebuild (e.g. `PLATFORM_REQUIRE_MFA=true`).
 */
@Injectable()
export class PlatformMfaGuard implements CanActivate {
    async canActivate(_context: ExecutionContext): Promise<boolean> {
        if (!platformOptions().requireMfa) {
            return true;
        }
        const user = await RequestContext.currentUser();
        if (!user?.isMfaEnabled) {
            throw new ForbiddenException({
                message:
                    'Platform access requires MFA. Enable MFA on your account first ' +
                    '(POST /auth/mfa/setup-totp → verify-totp-setup → toggle).',
                code: 'PLATFORM_MFA_REQUIRED',
            });
        }
        return true;
    }
}

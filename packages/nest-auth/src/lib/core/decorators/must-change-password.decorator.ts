import { SetMetadata } from '@nestjs/common';

/** Metadata key marking a route reachable even when the user must change their password. */
export const SKIP_MUST_CHANGE_PASSWORD_KEY = 'skip_must_change_password';

/**
 * `@SkipMustChangePassword()` — exempts a route (or controller) from the
 * "must change password" hard-block, so a user with `mustChangePassword: true`
 * can still reach it (e.g. change-password, logout, the current-user/session
 * endpoints, and the MFA flow needed to finish signing in).
 *
 * The library's own change-password / logout / me / verify-session / verification
 * and MFA routes are already marked. Add it to your own routes that must stay
 * reachable while a password change is pending.
 */
export const SkipMustChangePassword = () => SetMetadata(SKIP_MUST_CHANGE_PASSWORD_KEY, true);

import { SetMetadata } from '@nestjs/common';

/** Metadata key marking a route reachable even when the user's email is unverified. */
export const SKIP_EMAIL_VERIFICATION_KEY = 'skip_email_verification';

/**
 * `@SkipEmailVerification()` — exempts a route (or controller) from the
 * `registration.requireVerifiedEmail` hard-block, so a signed-in-but-unverified
 * user can still reach it (e.g. send-/verify-email, logout, the current-user /
 * session endpoints, refresh, and the MFA flow needed to finish signing in).
 *
 * The library's own verification / logout / me / session / refresh / MFA routes
 * are already marked. Add it to your own routes that must stay reachable while
 * email verification is pending.
 */
export const SkipEmailVerification = () => SetMetadata(SKIP_EMAIL_VERIFICATION_KEY, true);

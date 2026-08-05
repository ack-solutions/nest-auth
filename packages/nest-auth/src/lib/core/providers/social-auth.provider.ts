import { BaseAuthProvider, type AuthProviderUser } from './base-auth.provider';
import { NestAuthIdentity } from '../../user/entities/identity.entity';

/**
 * Base class for social / OAuth-style providers (Google, Apple, Facebook,
 * GitHub, and any custom SSO provider).
 *
 * The defining trait of these providers is that `validate()` returns the
 * *external* subject — the OAuth `sub` / provider account id — as
 * `AuthProviderUser.userId`, NOT our internal user UUID. (Contrast with
 * email/phone/passwordless, which return our own `user.id`.)
 *
 * BUG FIX (social-login uuid crash): after `validate()`, `AuthService.login`
 * resolves the already-linked identity via `provider.findLinkedIdentity(...)`.
 * The base implementation resolves by `userId` — a `uuid` column. Feeding it a
 * provider subject like Google's `109961585847656477769` makes Postgres throw
 * `invalid input syntax for type uuid`, so EVERY social login 500s. (SQLite/
 * sqljs doesn't enforce the column type, which is why the in-memory test suite
 * never caught it; on sqljs the same path instead returned `null` → a spurious
 * `INVALID_CREDENTIALS`.)
 *
 * We override `findLinkedIdentity` (NOT `findIdentityByUserId`, which must keep
 * meaning "by our user id") to resolve by `providerId` — which is exactly what
 * the external subject is. Existing identities are found by their provider
 * subject; a genuinely new user still falls through to `handleSocialLogin`
 * (which also resolves by `providerId`), so the two lookups stay consistent.
 *
 * Custom SSO/social providers should extend THIS class (not `BaseAuthProvider`)
 * so they inherit the correct lookup for free.
 */
export abstract class SocialAuthProvider extends BaseAuthProvider {
    override async findLinkedIdentity(validated: AuthProviderUser): Promise<NestAuthIdentity | null> {
        // `validated.userId` is the external subject (OAuth `sub` / account id),
        // stored as `auth_identity.providerId` — resolve by that, never by the
        // uuid `userId` column.
        return this.findIdentity(validated.userId);
    }
}

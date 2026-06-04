/**
 * Platform-admin wiring constants.
 *
 * A "platform admin" is a FULL `NestAuthUser` (so it gets social login, MFA, RBAC,
 * passwordless — everything) that holds a platform-level role:
 *   role name = `super_admin`, guard = `platform`, tenantId = NULL.
 *
 * The package resolves `tenantId = null` roles for a user on every login/refresh
 * (see access-role-resolver), so this role applies across the entire platform —
 * above all tenants. Endpoints are then gated with
 * `@NestAuthRoles(PLATFORM_SUPER_ADMIN_ROLE, PLATFORM_GUARD)`.
 */
export const PLATFORM_GUARD = 'platform';
export const PLATFORM_SUPER_ADMIN_ROLE = 'super_admin';

/** First platform admin, seeded on boot (override via env). */
export const PLATFORM_ADMIN_EMAIL = process.env.PLATFORM_ADMIN_EMAIL || 'platform@demo.test';
export const PLATFORM_ADMIN_PASSWORD = process.env.PLATFORM_ADMIN_PASSWORD || 'PlatformPass!1';

/**
 * Configurable platform-admin policy. In a real app you'd source these from your
 * config service; here they're env-driven so you can flip them per deployment.
 */
export interface PlatformOptions {
    /** Whether the platform-admin portal is mounted at all. */
    enabled: boolean;
    /** Whether to auto-seed the first platform admin on boot. */
    seed: boolean;
    /** Require platform admins to have MFA enabled before they can use the portal. */
    requireMfa: boolean;
}

function flag(value: string | undefined, fallback: boolean): boolean {
    if (value == null || value === '') return fallback;
    return value.toLowerCase() === 'true' || value === '1';
}

/** Read at request/boot time so policy can be changed without code edits. */
export function platformOptions(): PlatformOptions {
    return {
        enabled: flag(process.env.PLATFORM_ADMIN_ENABLED, true),
        seed: flag(process.env.PLATFORM_ADMIN_SEED, true),
        requireMfa: flag(process.env.PLATFORM_REQUIRE_MFA, false),
    };
}

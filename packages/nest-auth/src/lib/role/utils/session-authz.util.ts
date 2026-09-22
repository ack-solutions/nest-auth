/**
 * Live re-resolution of a session's roles/permissions from the SAME rows
 * sign-in reads (SessionTokenService.getUserWithAccess).
 *
 * `createSessionFromUser` copies the caller's roles and permission names into
 * `session.data`, and nothing refreshed that copy afterwards — so a permission
 * added to a role, a role granted/revoked, or a membership going INACTIVE never
 * reached anyone already signed in for the life of their session (the guard
 * authorizes from the copy, `GET /auth/me` recomputes, and the two disagreed).
 *
 * Static/active-record on purpose (same pattern as AccessRoleResolver): both
 * the auth guard and SessionManagerService.rotateSession need this without
 * dragging AuthModule services across module boundaries.
 */

import { Equal, IsNull } from 'typeorm';
import { NestAuthUserAccessStatusEnum } from '@ackplus/nest-auth-contracts';
import { NestAuthUserAccess } from '../../user/entities/user-access.entity';
import { NestAuthPlatformAccess } from '../../user/entities/platform-access.entity';
import { NestAuthRole } from '../entities/role.entity';
import { SessionDataPayload } from '../../core/interfaces/token-payload.interface';
import { getRolePermissionNames, mapRoleToSessionSnapshot } from './role-mapper.util';

export interface ResolvedSessionAuthz {
    roles: Partial<NestAuthRole>[];
    permissions: string[];
}

/** Map access-row roles into the exact shape createSessionFromUser stores. */
function toSessionAuthz(roles: NestAuthRole[]): ResolvedSessionAuthz {
    const permissions = new Set<string>();
    for (const role of roles) {
        for (const name of getRolePermissionNames(role)) {
            permissions.add(name);
        }
    }
    return {
        roles: roles.map((role) => mapRoleToSessionSnapshot(role)),
        permissions: Array.from(permissions),
    };
}

const AUTHZ_RELATIONS = ['roles', 'roles.rolePermissions', 'roles.rolePermissions.permission'];

/**
 * Resolve the CURRENT roles/permissions for a session's identity — platform
 * marker for platform sessions, the (userId, tenantId) access row otherwise.
 *
 * A missing or INACTIVE access row resolves to `{ roles: [], permissions: [] }`:
 * a member removed from a tenant must stop passing role/permission checks, not
 * keep the grants their sign-in copy carried.
 */
export async function resolveSessionAuthz(
    userId: string,
    tenantId: string | null | undefined,
    isPlatformAccess: boolean,
): Promise<ResolvedSessionAuthz> {
    if (isPlatformAccess) {
        const platformAccess = await NestAuthPlatformAccess.findOne({
            where: { userId, isActive: true },
            relations: AUTHZ_RELATIONS,
        });
        return toSessionAuthz(platformAccess?.roles ?? []);
    }

    const userAccess = await NestAuthUserAccess.findOne({
        where: {
            userId,
            status: NestAuthUserAccessStatusEnum.ACTIVE,
            tenantId: tenantId ? Equal(tenantId) : IsNull(),
        },
        relations: AUTHZ_RELATIONS,
    });
    return toSessionAuthz(userAccess?.roles ?? []);
}

/**
 * Return a COPY of `data` with `roles`/`permissions` re-resolved for the given
 * user. Everything else in `data` (user snapshot, isMfaVerified, custom fields
 * from `customizeSessionData`) is left untouched. Best-effort: any read failure
 * returns the original object unchanged — a refresh must never break auth, so
 * callers fall back to the sign-in copy (never to an empty one).
 */
export async function withFreshSessionAuthz(
    userId: string | undefined,
    data: SessionDataPayload | undefined,
): Promise<SessionDataPayload | undefined> {
    if (!userId || !data) return data;
    // Only sessions whose data was shaped by createSessionFromUser carry these
    // arrays; anything else (custom stores) is left alone.
    if (!Array.isArray(data.roles) && !Array.isArray(data.permissions)) return data;
    try {
        const fresh = await resolveSessionAuthz(userId, data.tenantId, data.isPlatformAccess === true);
        return { ...data, roles: fresh.roles as any, permissions: fresh.permissions };
    } catch {
        return data;
    }
}

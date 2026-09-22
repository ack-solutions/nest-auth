/**
 * Live session authorization (feedback: "a session's roles and permissions are
 * frozen at sign-in").
 *
 * `createSessionFromUser` copies the caller's roles + permission names into
 * `session.data`, the store persisted that copy for the session's whole life,
 * and the guard authorized from it. So a permission added to a role, a role
 * granted/revoked, or a membership going INACTIVE never reached anyone already
 * signed in — `GET /auth/me` recomputed from the DB and disagreed with the
 * guard (403s on routes /auth/me said were allowed).
 *
 * Now the guard re-resolves roles/permissions from the same rows sign-in reads
 * (authorization.liveSessionRoles, default on, 30s per-instance cache; ttl 0
 * here so every request re-resolves). NO MOCKS — real app, DB, HTTP, JWTs.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Controller, Get } from '@nestjs/common';
import request from 'supertest';
import { IsNull } from 'typeorm';
import { NestAuthUserAccessStatusEnum } from '@ackplus/nest-auth-contracts';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { Auth } from '../../src/lib/core/decorators/auth.decorator';
import { NestAuthRoles } from '../../src/lib/core/decorators/role.decorator';
import { NestAuthPermissions } from '../../src/lib/core/decorators/permissions.decorator';
import { RoleService, UserService } from '../../src';
import { PermissionService } from '../../src/lib/permission/services/permission.service';
import { NestAuthUserAccess } from '../../src/lib/user/entities/user-access.entity';
import { resolveSessionAuthz } from '../../src/lib/role/utils/session-authz.util';

const PASSWORD = 'LiveAuthz!1';

@Controller('live-authz')
class LiveAuthzController {
    @Get('any')
    @Auth()
    any() {
        return { ok: 'any' };
    }

    @Get('manager-only')
    @Auth()
    @NestAuthRoles(['manager'])
    managerOnly() {
        return { ok: 'manager' };
    }

    @Get('reports')
    @Auth()
    @NestAuthPermissions(['reports.view'])
    reports() {
        return { ok: 'reports' };
    }
}

const subOf = (body: any): string =>
    JSON.parse(Buffer.from((body?.accessToken ?? body?.tokens?.accessToken).split('.')[1], 'base64url').toString('utf8')).sub;

async function signup(handle: TestAppHandle, email: string): Promise<{ token: string; userId: string }> {
    const res = await request(handle.httpServer).post('/auth/signup').send({ email, password: PASSWORD });
    if (res.status >= 300) throw new Error(`signup failed: ${JSON.stringify(res.body)}`);
    return { token: res.body.accessToken ?? res.body.tokens?.accessToken, userId: subOf(res.body) };
}

const get = (handle: TestAppHandle, path: string, token: string) =>
    request(handle.httpServer).get(path).set('Authorization', `Bearer ${token}`);

describe('live session authz — changes reach signed-in sessions (ttl: 0)', () => {
    let handle: TestAppHandle;
    let roles: RoleService;
    let perms: PermissionService;
    let token: string;
    let userId: string;
    let roleId: string;

    beforeAll(async () => {
        handle = await bootTestApp({
            extraControllers: [LiveAuthzController],
            nestAuth: { authorization: { liveSessionRoles: { ttl: 0 } } as any },
        });
        roles = handle.get(RoleService);
        perms = handle.get(PermissionService);
        ({ token, userId } = await signup(handle, 'live-authz@test.local'));
    }, 60_000);

    afterAll(async () => {
        await handle?.close();
    });

    it('baseline: a fresh signup has neither the role nor the permission', async () => {
        expect((await get(handle, '/live-authz/any', token)).status).toBe(200);
        expect((await get(handle, '/live-authz/manager-only', token)).status).toBe(403);
        expect((await get(handle, '/live-authz/reports', token)).status).toBe(403);
    });

    it('a role granted AFTER sign-in takes effect with the SAME token (was: dead until re-login)', async () => {
        await perms.createPermission({ name: 'reports.view' });
        const role = await roles.createRole('manager', null, null, false, ['reports.view']);
        roleId = role.id;

        const access = await NestAuthUserAccess.findOne({ where: { userId, tenantId: IsNull() } });
        expect(access).toBeTruthy();
        await access!.assignRoles([roleId]);

        // No re-login. The frozen sign-in copy would still 403 both of these.
        expect((await get(handle, '/live-authz/manager-only', token)).status).toBe(200);
        expect((await get(handle, '/live-authz/reports', token)).status).toBe(200);
    });

    it('a permission REMOVED from the role is revoked mid-session too', async () => {
        await roles.updateRolePermissions(roleId, []);

        expect((await get(handle, '/live-authz/reports', token)).status).toBe(403); // permission gone
        expect((await get(handle, '/live-authz/manager-only', token)).status).toBe(200); // role remains
    });

    it('a membership going INACTIVE loses its grants (was: kept everything for the session lifetime)', async () => {
        const access = await NestAuthUserAccess.findOne({ where: { userId, tenantId: IsNull() } });
        access!.status = NestAuthUserAccessStatusEnum.INACTIVE;
        await access!.save();

        expect((await get(handle, '/live-authz/manager-only', token)).status).toBe(403);
        // Authentication itself is untouched — routes without role/permission
        // requirements still answer (revocation of grants, not of the session).
        expect((await get(handle, '/live-authz/any', token)).status).toBe(200);
    });

    it('GET /auth/me and the guard now agree (both recompute)', async () => {
        const me = await get(handle, '/auth/me', token);
        expect(me.status).toBe(200);
        const meRoles = (me.body.roles ?? []).map((r: any) => r.name);
        expect(meRoles).not.toContain('manager'); // access is INACTIVE
    });

    it('platform sessions resolve through the platform marker', async () => {
        const users = handle.get<UserService>(UserService);
        const pRole = await roles.createRole('platform-ops', null, null, true);
        const pUser = await users.createPlatformUser({ email: 'live-authz-platform@test.local', isActive: true });
        const pAccess = await (pUser as any).getPlatformAccess(true);
        await pAccess.assignRoles([pRole.id]);

        const authz = await resolveSessionAuthz(pUser.id, null, true);
        expect(authz.roles.map((r) => r.name)).toContain('platform-ops');
    });
});

describe('live session authz — opt-out restores the frozen-at-sign-in behavior', () => {
    let handle: TestAppHandle;

    beforeAll(async () => {
        handle = await bootTestApp({
            extraControllers: [LiveAuthzController],
            nestAuth: { authorization: { liveSessionRoles: false } as any },
        });
    }, 60_000);

    afterAll(async () => {
        await handle?.close();
    });

    it('liveSessionRoles: false — a role granted after sign-in does NOT take effect', async () => {
        const roles = handle.get<RoleService>(RoleService);
        const perms = handle.get<PermissionService>(PermissionService);
        const { token, userId } = await signup(handle, 'frozen-authz@test.local');

        await perms.createPermission({ name: 'reports.view' });
        const role = await roles.createRole('manager', null, null, false, ['reports.view']);
        const access = await NestAuthUserAccess.findOne({ where: { userId, tenantId: IsNull() } });
        await access!.assignRoles([role.id]);

        // Old behavior, by explicit request: still the sign-in copy.
        expect((await get(handle, '/live-authz/manager-only', token)).status).toBe(403);
        expect((await get(handle, '/live-authz/reports', token)).status).toBe(403);
    });
});

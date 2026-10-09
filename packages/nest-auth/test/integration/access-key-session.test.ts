/**
 * API-key ("access key") requests: off switch + a session for the key's user.
 *
 * Reported: signing in by API key could not be switched off, and a request let
 * through by key had no session — so `RequestContext.currentTenantId()` was
 * null and an app could not tenant-scope it without its own guard.
 *
 * Also pinned here, found in the same path:
 *  - a DEACTIVATED user's key kept authenticating (only the key's own isActive
 *    flag was checked);
 *  - role checks unioned roles across every membership, INACTIVE ones included.
 *
 * NO MOCKS — real app, real DB, real HTTP, real keys.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Controller, Get, Post } from '@nestjs/common';
import request from 'supertest';
import { NestAuthUserAccessStatusEnum, TenantModeEnum } from '@ackplus/nest-auth-contracts';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { Auth } from '../../src/lib/core/decorators/auth.decorator';
import { NestAuthRoles } from '../../src/lib/core/decorators/role.decorator';
import { RequestContext } from '../../src/lib/request-context/request-context';
import { AccessKeyService } from '../../src/lib/user/services/access-key.service';
import { NestAuthUserAccess } from '../../src/lib/user/entities/user-access.entity';
import { RoleService, TenantService, UserService } from '../../src';

const PASSWORD = 'KeySession!1';

@Controller('key-scope')
class KeyScopeController {
    @Get('whoami')
    @Auth()
    async whoami() {
        const session = RequestContext.currentSession();
        return {
            userId: RequestContext.currentUserId(),
            tenantId: RequestContext.currentTenantId(),
            hasUserAccess: !!(await RequestContext.currentUserAccess()),
            authType: session?.data?.authType ?? null,
            sessionId: session?.id ?? null,
            roles: (session?.data?.roles ?? []).map((r: any) => r.name),
        };
    }

    @Get('manager-only')
    @Auth()
    @NestAuthRoles(['manager'])
    managerOnly() {
        return { ok: true };
    }

    @Post('noop')
    @Auth(true)
    optional() {
        return { userId: RequestContext.currentUserId() };
    }
}

const subOf = (body: any): string =>
    JSON.parse(Buffer.from((body?.accessToken ?? body?.tokens?.accessToken).split('.')[1], 'base64url').toString('utf8')).sub;

const withKey = (handle: TestAppHandle, method: 'get' | 'post', path: string, key: { publicKey: string; privateKey: string }) =>
    (request(handle.httpServer) as any)[method](path).set('Authorization', `ApiKey ${key.publicKey}.${key.privateKey}`);

describe('API key — per-request session (ISOLATED: one membership per user)', () => {
    let handle: TestAppHandle;
    let keys: AccessKeyService;
    let acmeId: string;
    let globexId: string;
    let userId: string;
    let key: { publicKey: string; privateKey: string };

    beforeAll(async () => {
        handle = await bootTestApp({
            extraControllers: [KeyScopeController],
            nestAuth: { tenant: { enabled: true, mode: TenantModeEnum.ISOLATED } as any },
        });
        keys = handle.get(AccessKeyService);
        const tenants = handle.get<TenantService>(TenantService);
        acmeId = (await tenants.createTenant({ slug: 'acme', name: 'Acme' })).id!;
        globexId = (await tenants.createTenant({ slug: 'globex', name: 'Globex' })).id!;

        const signup = await request(handle.httpServer)
            .post('/auth/signup')
            .send({ email: 'key-owner@test.local', password: PASSWORD, tenantId: acmeId });
        expect(signup.status, JSON.stringify(signup.body)).toBeLessThan(300);
        userId = subOf(signup.body);
        key = await keys.createAccessKey(userId, 'ci');
    }, 60_000);

    afterAll(async () => {
        await handle?.close();
    });

    it('a key request now carries the user AND the tenant (was: no session, tenant null)', async () => {
        const res = await withKey(handle, 'get', '/key-scope/whoami', key);
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect(res.body.userId).toBe(userId);
        expect(res.body.tenantId).toBe(acmeId);
        expect(res.body.hasUserAccess).toBe(true);
        expect(res.body.authType).toBe('api-key');
        expect(res.body.sessionId).toBeNull(); // per-request, never persisted
    });

    it('GET /auth/me works with a key (was: 500 — it dereferenced a null session)', async () => {
        const res = await withKey(handle, 'get', '/auth/me', key);
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect(res.body.id).toBe(userId);
    });

    it('roles come from the membership, live', async () => {
        expect((await withKey(handle, 'get', '/key-scope/manager-only', key)).status).toBe(403);

        const role = await handle.get<RoleService>(RoleService).createRole('manager', null, acmeId);
        const access = await NestAuthUserAccess.findOne({ where: { userId, tenantId: acmeId } });
        await access!.assignRoles([role.id]);

        expect((await withKey(handle, 'get', '/key-scope/manager-only', key)).status).toBe(200);
    });

    it('an INACTIVE membership grants nothing (was: its roles still passed the check)', async () => {
        const access = await NestAuthUserAccess.findOne({ where: { userId, tenantId: acmeId } });
        access!.status = NestAuthUserAccessStatusEnum.INACTIVE;
        await access!.save();
        try {
            expect((await withKey(handle, 'get', '/key-scope/manager-only', key)).status).toBe(403);
            const who = await withKey(handle, 'get', '/key-scope/whoami', key);
            expect(who.body.tenantId).toBeNull(); // no active membership to act in
        } finally {
            access!.status = NestAuthUserAccessStatusEnum.ACTIVE;
            await access!.save();
        }
    });

    it('a pinned key cannot be minted for a tenant the user is not an active member of', async () => {
        await expect(keys.createAccessKey(userId, 'bad-pin', { tenantId: globexId })).rejects.toMatchObject({
            response: { code: 'API_KEY_TENANT_MISMATCH' },
        });
        const pinned = await keys.createAccessKey(userId, 'pinned', { tenantId: acmeId });
        const who = await withKey(handle, 'get', '/key-scope/whoami', pinned);
        expect(who.body.tenantId).toBe(acmeId);
    });

    it('session-mutating endpoints treat a key as "no session"', async () => {
        const res = await withKey(handle, 'post', '/auth/logout', key);
        expect(res.status).toBeLessThan(500);
        // …and the key still works afterwards: nothing was revoked.
        expect((await withKey(handle, 'get', '/key-scope/whoami', key)).status).toBe(200);
    });

    it("a DEACTIVATED user's key stops authenticating (was: kept working)", async () => {
        const users = handle.get<UserService>(UserService);
        await users.updateUserStatus(userId, false);
        try {
            const res = await withKey(handle, 'get', '/key-scope/whoami', key);
            expect(res.status).toBe(401);
            expect(res.body.code).toBe('ACCOUNT_INACTIVE');
        } finally {
            await users.updateUserStatus(userId, true);
        }
        expect((await withKey(handle, 'get', '/key-scope/whoami', key)).status).toBe(200);
    });

    it('a wrong private key is still rejected', async () => {
        const res = await withKey(handle, 'get', '/key-scope/whoami', { publicKey: key.publicKey, privateKey: 'nope' });
        expect(res.status).toBe(401);
    });
});

describe('API key — accessKeys.enabled: false switches it off', () => {
    let handle: TestAppHandle;

    beforeAll(async () => {
        handle = await bootTestApp({
            extraControllers: [KeyScopeController],
            nestAuth: { accessKeys: { enabled: false } as any },
        });
    }, 60_000);

    afterAll(async () => {
        await handle?.close();
    });

    it('rejects any ApiKey credential with 401 API_KEY_AUTH_DISABLED, bearer still works', async () => {
        const signup = await request(handle.httpServer)
            .post('/auth/signup')
            .send({ email: 'no-keys@test.local', password: PASSWORD });
        const token = signup.body.accessToken ?? signup.body.tokens?.accessToken;

        const byKey = await request(handle.httpServer)
            .get('/key-scope/whoami')
            .set('Authorization', 'ApiKey somepublic.someprivate');
        expect(byKey.status).toBe(401);
        expect(byKey.body.code).toBe('API_KEY_AUTH_DISABLED');

        const byBearer = await request(handle.httpServer).get('/key-scope/whoami').set('Authorization', `Bearer ${token}`);
        expect(byBearer.status).toBe(200);
        expect(byBearer.body.sessionId).toBeTruthy();
    });

    it('optional-auth routes proceed unauthenticated; no key can be minted', async () => {
        const res = await request(handle.httpServer)
            .post('/key-scope/noop')
            .set('Authorization', 'ApiKey somepublic.someprivate');
        expect(res.status).toBeLessThan(300);
        expect(res.body.userId ?? null).toBeNull();

        const signup = await request(handle.httpServer)
            .post('/auth/signup')
            .send({ email: 'no-keys-2@test.local', password: PASSWORD });
        await expect(
            handle.get<AccessKeyService>(AccessKeyService).createAccessKey(subOf(signup.body), 'x'),
        ).rejects.toMatchObject({ response: { code: 'API_KEY_AUTH_DISABLED' } });
    });
});

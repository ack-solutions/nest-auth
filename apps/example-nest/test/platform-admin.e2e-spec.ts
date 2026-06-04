/**
 * Platform-admin portal (e2e).
 *
 * The recommended way to run a "manage the entire platform" admin:
 *   - a FULL nest-auth user (social login / MFA / RBAC all work),
 *   - holding a platform role (`super_admin`, guard `platform`) granted via the
 *     first-class `NestAuthPlatformAccess` (cross-tenant),
 *   - origin-locked: platform roles are only resolved when the login request comes
 *     from the platform portal (the `x-platform-portal` header → platformAccess.validate).
 *
 * First platform admin is seeded on boot: platform@demo.test / PlatformPass!1.
 */

import request from 'supertest';
import speakeasy from 'speakeasy';
import { RoleService, UserService } from '@ackplus/nest-auth';
import { createTestApp, type E2EApp } from './utils/test-app';
import { signup, loginEmail, extractTokens, uniqueEmail, bearer, userIdFromToken } from './utils/api';

const PADMIN = 'platform@demo.test';
const PPASS = 'PlatformPass!1';

/** Log in *through the platform portal* (origin-lock header → platform session). */
function loginPortal(http: any, email: string, password: string) {
    return request(http)
        .post('/api/auth/login')
        .set('x-platform-portal', 'true')
        .send({ providerName: 'email', credentials: { email, password } });
}

describe('Platform admin (e2e)', () => {
    let api: E2EApp;

    beforeAll(async () => {
        api = await createTestApp();
    });

    afterAll(async () => {
        await api.close();
    });

    async function platformToken(): Promise<string> {
        const res = await loginPortal(api.http, PADMIN, PPASS);
        const { accessToken } = extractTokens(res.body);
        if (!accessToken) throw new Error(`platform admin login failed: ${res.status} ${JSON.stringify(res.body)}`);
        return accessToken;
    }

    it('the seeded platform admin is a FULL nest-auth user (login + /auth/me + MFA available)', async () => {
        const token = await platformToken();
        const me = await request(api.http).get('/api/auth/me').set(...bearer(token));
        expect(me.status).toBe(200);
        const setup = await request(api.http).post('/api/auth/mfa/setup-totp').set(...bearer(token)).send({});
        expect(setup.status).toBeLessThan(300);
        expect(typeof setup.body.secret).toBe('string');
    });

    it('platform admin can manage the whole platform (cross-tenant endpoints)', async () => {
        const token = await platformToken();
        for (const path of ['me', 'tenants', 'users', 'stats']) {
            const res = await request(api.http).get(`/api/platform/${path}`).set(...bearer(token));
            expect(res.status).toBe(200);
        }
        const users = await request(api.http).get('/api/platform/users').set(...bearer(token));
        expect(Array.isArray(users.body.users)).toBe(true);
        expect(users.body.total).toBeGreaterThanOrEqual(1);
    });

    it('a regular user is BLOCKED from the platform portal (403)', async () => {
        const created = await signup(api.http, { email: uniqueEmail('user'), password: 'UserPass!1' });
        const { accessToken } = extractTokens(created.body);
        const res = await request(api.http).get('/api/platform/me').set(...bearer(accessToken!));
        expect(res.status).toBe(403);
    });

    it('origin-lock: even a platform admin logged in WITHOUT the portal header is blocked (403)', async () => {
        // same seeded super-admin, but a normal (non-portal) login → no platform roles resolved
        const token = extractTokens((await loginEmail(api.http, PADMIN, PPASS)).body).accessToken;
        const res = await request(api.http).get('/api/platform/me').set(...bearer(token!));
        expect(res.status).toBe(403);
    });

    it('unauthenticated access to the platform portal -> 401', async () => {
        const res = await request(api.http).get('/api/platform/me');
        expect(res.status).toBe(401);
    });

    it('privilege escalation blocked: a regular user cannot grant themselves the platform role (403)', async () => {
        const email = uniqueEmail('escalate');
        const created = await signup(api.http, { email, password: 'UserPass!1' });
        const { accessToken } = extractTokens(created.body);
        const res = await request(api.http)
            .post('/api/platform/grant-admin')
            .set(...bearer(accessToken!))
            .send({ email });
        expect(res.status).toBe(403);
    });

    it('a platform admin CAN grant the role; the grantee gains access after a portal re-login', async () => {
        const email = uniqueEmail('promote');
        const password = 'PromotePass!1';
        await signup(api.http, { email, password });

        // before: a non-platform user can't even log in through the portal (403 ACCESS_DENIED)
        const before = await loginPortal(api.http, email, password);
        expect(before.status).toBe(403);

        // platform admin grants platform access
        const padminTok = await platformToken();
        const grant = await request(api.http)
            .post('/api/platform/grant-admin')
            .set(...bearer(padminTok))
            .send({ email });
        expect(grant.status).toBeLessThan(300);

        // after: portal login now succeeds → access granted
        const after = await loginPortal(api.http, email, password);
        expect(after.status).toBeLessThan(300);
        const afterTok = extractTokens(after.body).accessToken;
        const res = await request(api.http).get('/api/platform/me').set(...bearer(afterTok!));
        expect(res.status).toBe(200);
    });
});

describe('Platform admin — MFA-required policy (e2e)', () => {
    let api: E2EApp;
    const totp = (s: string) => speakeasy.totp({ secret: s, encoding: 'base32' });

    beforeAll(async () => {
        process.env.PLATFORM_REQUIRE_MFA = 'true'; // policy on (read per-request by the guard)
        api = await createTestApp();
    });

    afterAll(async () => {
        await api.close();
        delete process.env.PLATFORM_REQUIRE_MFA;
    });

    /** Sign up a user and grant platform access via the first-class PlatformAccess. */
    async function makePlatformUser(): Promise<{ email: string; password: string }> {
        const email = uniqueEmail('padmin');
        const password = 'PUserPass!1';
        const created = await signup(api.http, { email, password });
        const userId = userIdFromToken(extractTokens(created.body).accessToken!);
        const role = await api.get(RoleService).getRoleByName('super_admin', 'platform');
        const user = await api.get(UserService).getUserById(userId);
        const platformAccess = await user.getPlatformAccess(true);
        await platformAccess.assignRoles([role!.id]);
        return { email, password };
    }

    it('blocks a platform admin who has NOT enabled MFA (403 PLATFORM_MFA_REQUIRED)', async () => {
        const { email, password } = await makePlatformUser();
        const token = extractTokens((await loginPortal(api.http, email, password)).body).accessToken;
        const res = await request(api.http).get('/api/platform/me').set(...bearer(token!));
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('PLATFORM_MFA_REQUIRED');
    });

    it('allows the platform admin once MFA is enabled (enroll → MFA portal login → access)', async () => {
        const { email, password } = await makePlatformUser();

        // enrol MFA (not behind the platform guard) using a normal token
        const t0 = extractTokens((await loginEmail(api.http, email, password)).body).accessToken;
        const secret = (
            await request(api.http).post('/api/auth/mfa/setup-totp').set(...bearer(t0!)).send({})
        ).body.secret;
        await request(api.http)
            .post('/api/auth/mfa/verify-totp-setup')
            .set(...bearer(t0!))
            .send({ secret, otp: totp(secret) });
        await request(api.http).post('/api/auth/mfa/toggle').set(...bearer(t0!)).send({ enabled: true });

        // portal login now requires the MFA challenge (header on both legs → platform session)
        const login = await loginPortal(api.http, email, password);
        expect(login.body.isRequiresMfa).toBe(true);
        const pending = extractTokens(login.body).accessToken;
        const verify = await request(api.http)
            .post('/api/auth/mfa/verify')
            .set('x-platform-portal', 'true')
            .set(...bearer(pending!))
            .send({ method: 'totp', otp: totp(secret) });
        const finalToken = extractTokens(verify.body).accessToken;

        const res = await request(api.http).get('/api/platform/me').set(...bearer(finalToken!));
        expect(res.status).toBe(200);
    });
});

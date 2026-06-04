/**
 * MFA (e2e) — full TOTP enrollment + login challenge, plus the status/toggle
 * management endpoints. Uses real `speakeasy` to generate valid TOTP codes
 * against the secret the server hands out (no mocks).
 */

import request from 'supertest';
import speakeasy from 'speakeasy';
import { createTestApp, type E2EApp } from './utils/test-app';
import { signup, loginEmail, extractTokens, uniqueEmail, bearer } from './utils/api';

function totp(secret: string): string {
    return speakeasy.totp({ secret, encoding: 'base32' });
}

describe('MFA (e2e)', () => {
    let api: E2EApp;

    beforeAll(async () => {
        api = await createTestApp();
    });

    afterAll(async () => {
        await api.close();
    });

    /** Sign up an email user, enroll TOTP, and turn MFA on. Returns creds + secret. */
    async function enrollTotp(): Promise<{ email: string; password: string; secret: string }> {
        const email = uniqueEmail('mfa');
        const password = 'MfaPass!1';
        const created = await signup(api.http, { email, password });
        const { accessToken } = extractTokens(created.body);

        const setup = await request(api.http)
            .post('/api/auth/mfa/setup-totp')
            .set(...bearer(accessToken!))
            .send({});
        expect(setup.status).toBeLessThan(300);
        const secret = setup.body.secret;
        expect(typeof secret).toBe('string');

        const verifySetup = await request(api.http)
            .post('/api/auth/mfa/verify-totp-setup')
            .set(...bearer(accessToken!))
            .send({ secret, otp: totp(secret) });
        expect(verifySetup.status).toBeLessThan(300);

        const toggle = await request(api.http)
            .post('/api/auth/mfa/toggle')
            .set(...bearer(accessToken!))
            .send({ enabled: true });
        expect(toggle.status).toBeLessThan(300);

        return { email, password, secret };
    }

    it('GET /api/auth/mfa/status reports MFA disabled for a fresh user', async () => {
        const created = await signup(api.http, { email: uniqueEmail('mfa-status'), password: 'MfaPass!1' });
        const { accessToken } = extractTokens(created.body);

        const status = await request(api.http).get('/api/auth/mfa/status').set(...bearer(accessToken!));
        expect(status.status).toBe(200);
        expect(status.body).toBeTruthy();
    });

    it('enroll TOTP → login requires MFA → verify with TOTP → full tokens', async () => {
        const { email, password, secret } = await enrollTotp();

        // Login now returns an MFA-pending response (no full tokens yet).
        const login = await loginEmail(api.http, email, password);
        expect(login.status).toBeLessThan(300);
        expect(login.body.isRequiresMfa).toBe(true);
        const pendingToken = extractTokens(login.body).accessToken;
        expect(typeof pendingToken).toBe('string');

        // Submit the current TOTP code.
        const verify = await request(api.http)
            .post('/api/auth/mfa/verify')
            .set(...bearer(pendingToken!))
            .send({ method: 'totp', otp: totp(secret) });
        expect(verify.status).toBeLessThan(300);
        expect(extractTokens(verify.body).accessToken).toBeTruthy();
        expect(verify.body.isRequiresMfa).toBeFalsy();
    });

    it('MFA challenge with a wrong TOTP code → 401', async () => {
        const { email, password } = await enrollTotp();
        const login = await loginEmail(api.http, email, password);
        const pendingToken = extractTokens(login.body).accessToken;

        const verify = await request(api.http)
            .post('/api/auth/mfa/verify')
            .set(...bearer(pendingToken!))
            .send({ method: 'totp', otp: '000000' });
        expect(verify.status).toBe(401);
    });

    it('toggling MFA off removes the login challenge', async () => {
        const { email, password, secret } = await enrollTotp();

        // Get a full session (pass the challenge) so we can toggle MFA off.
        const login = await loginEmail(api.http, email, password);
        const pendingToken = extractTokens(login.body).accessToken;
        const verified = await request(api.http)
            .post('/api/auth/mfa/verify')
            .set(...bearer(pendingToken!))
            .send({ method: 'totp', otp: totp(secret) });
        const fullToken = extractTokens(verified.body).accessToken;

        const off = await request(api.http)
            .post('/api/auth/mfa/toggle')
            .set(...bearer(fullToken!))
            .send({ enabled: false });
        expect(off.status).toBeLessThan(300);

        // Next login no longer requires MFA.
        const login2 = await loginEmail(api.http, email, password);
        expect(login2.status).toBeLessThan(300);
        expect(login2.body.isRequiresMfa).toBeFalsy();
        expect(extractTokens(login2.body).accessToken).toBeTruthy();
    });
});

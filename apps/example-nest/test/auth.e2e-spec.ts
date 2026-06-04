/**
 * Auth API — signup, login, and session introspection (real HTTP, real DB).
 *
 * Booted against the REAL example AppModule. Every request is an actual HTTP call
 * through the `/api` prefix, exactly like the example-react / example-next apps
 * make via `@ackplus/nest-auth-client`.
 */

import request from 'supertest';
import { createTestApp, type E2EApp } from './utils/test-app';
import {
    signup,
    loginEmail,
    loginPhone,
    extractTokens,
    uniqueEmail,
    uniquePhone,
    bearer,
} from './utils/api';

describe('Auth API (e2e)', () => {
    let api: E2EApp;

    beforeAll(async () => {
        api = await createTestApp();
    });

    afterAll(async () => {
        await api.close();
    });

    describe('POST /api/auth/signup', () => {
        it('creates an email user and returns JWT access + refresh tokens', async () => {
            const res = await signup(api.http, { email: uniqueEmail('signup'), password: 'StrongPassword!1' });

            expect(res.status).toBeGreaterThanOrEqual(200);
            expect(res.status).toBeLessThan(300);

            const { accessToken, refreshToken } = extractTokens(res.body);
            expect(typeof accessToken).toBe('string');
            expect(typeof refreshToken).toBe('string');
            expect(accessToken!.split('.')).toHaveLength(3); // JWT shape
            expect(res.body.isRequiresMfa).toBe(false);
        });

        it('never echoes the plaintext password back in the response', async () => {
            const password = 'DoNotEcho_!42xyz';
            const res = await signup(api.http, { email: uniqueEmail('noecho'), password });
            expect(JSON.stringify(res.body)).not.toContain(password);
        });

        it('rejects a duplicate email with a 4xx conflict', async () => {
            const email = uniqueEmail('dupe');
            const first = await signup(api.http, { email, password: 'StrongPassword!1' });
            expect(first.status).toBeLessThan(300);

            const second = await signup(api.http, { email, password: 'StrongPassword!1' });
            expect(second.status).toBeGreaterThanOrEqual(400);
            expect(second.status).toBeLessThan(500);
        });

        it('rejects an invalid email format with 400', async () => {
            const res = await signup(api.http, { email: 'not-an-email', password: 'StrongPassword!1' });
            expect(res.status).toBe(400);
        });

        it('rejects a weak password with 400', async () => {
            const res = await signup(api.http, { email: uniqueEmail('weak'), password: 'short' });
            expect(res.status).toBe(400);
        });

        it('creates a phone user and returns tokens', async () => {
            const res = await signup(api.http, { phone: uniquePhone(), password: 'StrongPassword!1' });
            if (res.status >= 400) {
                // eslint-disable-next-line no-console
                console.error('[phone signup]', res.status, JSON.stringify(res.body));
            }
            expect(res.status).toBeGreaterThanOrEqual(200);
            expect(res.status).toBeLessThan(300);
        });
    });

    describe('POST /api/auth/login', () => {
        it('logs in with email + password after signup (round-trip)', async () => {
            const email = uniqueEmail('login');
            const password = 'RoundTrip_!1';
            await signup(api.http, { email, password });

            const res = await loginEmail(api.http, email, password);
            expect(res.status).toBeLessThan(300);
            const { accessToken, refreshToken } = extractTokens(res.body);
            expect(typeof accessToken).toBe('string');
            expect(typeof refreshToken).toBe('string');
        });

        it('logs in with phone + password (TC-054)', async () => {
            const phone = uniquePhone();
            const password = 'PhonePass_!1';
            const created = await signup(api.http, { phone, password });
            expect(created.status).toBeLessThan(300);

            const res = await loginPhone(api.http, phone, password);
            if (res.status >= 400) {
                // eslint-disable-next-line no-console
                console.error('[phone+password login]', res.status, JSON.stringify(res.body));
            }
            expect(res.status).toBeLessThan(300);
            const { accessToken } = extractTokens(res.body);
            expect(typeof accessToken).toBe('string');
        });

        it('rejects a wrong password with 401', async () => {
            const email = uniqueEmail('wrongpw');
            await signup(api.http, { email, password: 'CorrectHorse_!1' });

            const res = await loginEmail(api.http, email, 'WrongPassword_!9');
            expect(res.status).toBe(401);
        });

        it('rejects an unknown email with 401 (no account enumeration)', async () => {
            const res = await loginEmail(api.http, uniqueEmail('ghost'), 'AnyPassword_!1');
            expect(res.status).toBe(401);
        });
    });

    describe('Session introspection', () => {
        it('GET /api/auth/me returns the current user when authenticated', async () => {
            const email = uniqueEmail('me');
            const password = 'MePass_!1';
            const created = await signup(api.http, { email, password });
            const { accessToken } = extractTokens(created.body);

            const res = await request(api.http).get('/api/auth/me').set(...bearer(accessToken!));
            expect(res.status).toBe(200);
            expect(JSON.stringify(res.body).toLowerCase()).toContain(email.toLowerCase());
        });

        it('GET /api/auth/me returns 401 without a token', async () => {
            const res = await request(api.http).get('/api/auth/me');
            expect(res.status).toBe(401);
        });

        it('GET /api/auth/user returns the full user object when authenticated (TC-056)', async () => {
            const email = uniqueEmail('fulluser');
            const created = await signup(api.http, { email, password: 'FullUser_!1' });
            const { accessToken } = extractTokens(created.body);

            const res = await request(api.http).get('/api/auth/user').set(...bearer(accessToken!));
            expect(res.status).toBe(200);
            expect(res.body).toBeTruthy();
        });

        it('GET /api/auth/verify-session validates an active session (TC-144)', async () => {
            const created = await signup(api.http, { email: uniqueEmail('verify'), password: 'Verify_!1' });
            const { accessToken } = extractTokens(created.body);

            const res = await request(api.http).get('/api/auth/verify-session').set(...bearer(accessToken!));
            expect(res.status).toBe(200);
        });

        it('GET /api/auth/client-config is public and leaks no secrets (TC-366)', async () => {
            const res = await request(api.http).get('/api/auth/client-config');
            expect(res.status).toBe(200);
            expect(typeof res.body).toBe('object');

            const serialized = JSON.stringify(res.body);
            expect(serialized).not.toContain(process.env.JWT_SECRET);
            expect(serialized).not.toContain(process.env.ADMIN_CONSOLE_SECRET_KEY);
        });
    });
});

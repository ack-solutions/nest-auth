/**
 * Sessions (e2e) — refresh, logout, logout-all, and the consumer-owned
 * /api/sessions controller (list + revoke). Real session rows, real HTTP.
 */

import request from 'supertest';
import { createTestApp, type E2EApp } from './utils/test-app';
import { signup, loginEmail, extractTokens, uniqueEmail, bearer } from './utils/api';

describe('Sessions (e2e)', () => {
    let api: E2EApp;

    beforeAll(async () => {
        api = await createTestApp();
    });

    afterAll(async () => {
        await api.close();
    });

    it('POST /api/auth/refresh-token returns a fresh access + refresh pair', async () => {
        const created = await signup(api.http, { email: uniqueEmail('refresh'), password: 'RefreshPass!1' });
        const { refreshToken } = extractTokens(created.body);
        expect(typeof refreshToken).toBe('string');

        const res = await request(api.http).post('/api/auth/refresh-token').send({ refreshToken });
        expect(res.status).toBeLessThan(300);
        expect(typeof extractTokens(res.body).accessToken).toBe('string');
    });

    it('logout revokes the current session (guarded route then rejects the token)', async () => {
        const created = await signup(api.http, { email: uniqueEmail('logout'), password: 'LogoutPass!1' });
        const { accessToken } = extractTokens(created.body);

        const before = await request(api.http).get('/api/auth/me').set(...bearer(accessToken!));
        expect(before.status).toBe(200);

        const logout = await request(api.http).post('/api/auth/logout').set(...bearer(accessToken!)).send({});
        expect(logout.status).toBeLessThan(300);

        const after = await request(api.http).get('/api/auth/me').set(...bearer(accessToken!));
        expect([401, 403]).toContain(after.status);
    });

    it('GET /api/sessions lists active sessions; logout-all clears them', async () => {
        const email = uniqueEmail('multi');
        const password = 'MultiPass!1';
        await signup(api.http, { email, password });

        // Two more logins → multiple sessions for the same user.
        const l1 = await loginEmail(api.http, email, password);
        const l2 = await loginEmail(api.http, email, password);
        const token1 = extractTokens(l1.body).accessToken;
        const token2 = extractTokens(l2.body).accessToken;

        const list = await request(api.http).get('/api/sessions').set(...bearer(token1!));
        expect(list.status).toBe(200);
        const sessions = list.body?.sessions ?? list.body?.data ?? list.body;
        expect(Array.isArray(sessions)).toBe(true);
        expect(sessions.length).toBeGreaterThanOrEqual(2);

        // logout-all kills every session for the user.
        const logoutAll = await request(api.http).post('/api/auth/logout-all').set(...bearer(token2!)).send({});
        expect(logoutAll.status).toBeLessThan(300);

        const after = await request(api.http).get('/api/auth/me').set(...bearer(token1!));
        expect([401, 403]).toContain(after.status);
    });
});

/**
 * Admin console (e2e) — admin signup (secret-key gated), cookie login, and a
 * protected admin API (list users). Demonstrates the cookie-session admin flow.
 */

import request from 'supertest';
import { createTestApp, type E2EApp } from './utils/test-app';
import { signup, uniqueEmail } from './utils/api';

const ADMIN_SECRET = process.env.ADMIN_CONSOLE_SECRET_KEY!;

describe('Admin console (e2e)', () => {
    let api: E2EApp;

    beforeAll(async () => {
        api = await createTestApp();
    });

    afterAll(async () => {
        await api.close();
    });

    it('rejects admin signup with the wrong secret key', async () => {
        const res = await request(api.http)
            .post('/api/auth/admin/signup')
            .send({ email: uniqueEmail('admin'), password: 'AdminPass!1', name: 'Bad', secretKey: 'wrong-secret' });
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.status).toBeLessThan(500);
    });

    it('admin signup (valid secret) → cookie login → list users via the admin API', async () => {
        const email = uniqueEmail('admin');
        const password = 'AdminPass!1';

        // Seed a normal user so the list has at least one row.
        await signup(api.http, { email: uniqueEmail('member'), password: 'MemberPass!1' });

        const created = await request(api.http)
            .post('/api/auth/admin/signup')
            .send({ email, password, name: 'Root Admin', secretKey: ADMIN_SECRET });
        expect(created.status).toBeLessThan(300);

        const login = await request(api.http)
            .post('/api/auth/admin/login')
            .send({ email, password });
        expect(login.status).toBeLessThan(300);

        const cookie = login.headers['set-cookie'];
        expect(cookie).toBeTruthy();

        // The admin session cookie authorizes the admin API.
        const users = await request(api.http)
            .get('/api/auth/admin/api/users')
            .set('Cookie', cookie);
        expect(users.status).toBe(200);
        const list = users.body?.data ?? users.body?.users ?? users.body?.items ?? users.body;
        expect(list).toBeTruthy();
    });

    it('blocks the admin API without a session cookie', async () => {
        const res = await request(api.http).get('/api/auth/admin/api/users');
        expect([401, 403]).toContain(res.status);
    });

    it('GET /auth/admin serves the dashboard SPA when bundled, else a graceful 404 (never 500)', async () => {
        // The admin UI bundle is built by `@ackplus/nest-auth-admin` into
        // nest-auth/dist/lib/admin-console/static/index.html. It may or may not be
        // present depending on build order — either way this must NOT 500.
        const res = await request(api.http).get('/api/auth/admin');
        expect([200, 404]).toContain(res.status);
        if (res.status === 200) {
            expect(res.headers['content-type']).toMatch(/text\/html/);
            expect(res.text.length).toBeGreaterThan(0);
        } else {
            // Bundle absent → clear plain-text guidance, not a server error.
            expect(res.text).toMatch(/admin/i);
        }
    });
});

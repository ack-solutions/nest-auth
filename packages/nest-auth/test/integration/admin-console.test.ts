/**
 * Real integration tests for the admin console auth flow.
 *
 * NO MOCKS. Boots the app with adminConsole enabled + a secret key, drives the
 * HTTP endpoints with a cookie-persisting supertest agent.
 *
 * Covers: TC-310 (admin signup w/ secret), TC-311 (wrong secret → 403/401),
 *         TC-312 (admin login validates password), TC-313 (session cookie).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

const SECRET = 'test-admin-secret-key-123';
const ADMIN_PASSWORD = 'AdminPass!1word';

describe('Admin console auth — TC-310..TC-313', () => {
  let handle: TestAppHandle;

  beforeEach(async () => {
    handle = await bootTestApp({
      nestAuth: {
        adminConsole: { enabled: true, secretKey: SECRET } as any,
      },
    });
  });

  afterEach(async () => {
    await handle.close();
  });

  it('TC-311: admin signup with WRONG secret key → 401', async () => {
    const res = await request(handle.httpServer)
      .post('/auth/admin/signup')
      .send({ email: 'admin1@test.local', password: ADMIN_PASSWORD, secretKey: 'wrong-secret' });
    expect(res.status).toBe(401);
  });

  it('TC-310: admin signup with correct secret key → creates admin', async () => {
    const res = await request(handle.httpServer)
      .post('/auth/admin/signup')
      .send({ email: 'admin2@test.local', password: ADMIN_PASSWORD, secretKey: SECRET });

    if (res.status >= 400) {
      // eslint-disable-next-line no-console
      console.error('[admin signup failure]', res.status, JSON.stringify(res.body, null, 2));
    }
    expect(res.status).toBeLessThan(300);
    expect(JSON.stringify(res.body)).not.toContain(ADMIN_PASSWORD);
  });

  it('TC-312/313: full admin flow — signup → login (cookie) → me', async () => {
    const email = 'admin3@test.local';

    // signup
    const signup = await request(handle.httpServer)
      .post('/auth/admin/signup')
      .send({ email, password: ADMIN_PASSWORD, secretKey: SECRET });
    expect(signup.status).toBeLessThan(300);

    // login → returns the session cookie
    const login = await request(handle.httpServer)
      .post('/auth/admin/login')
      .send({ email, password: ADMIN_PASSWORD });
    if (login.status >= 400) {
      // eslint-disable-next-line no-console
      console.error('[admin login failure]', login.status, JSON.stringify(login.body, null, 2));
    }
    expect(login.status).toBeLessThan(300);

    const setCookie = login.headers['set-cookie'];
    expect(setCookie, 'admin login should set a session cookie').toBeDefined();
    const cookieHeader = (Array.isArray(setCookie) ? setCookie : [setCookie])
      .map((c) => c.split(';')[0])
      .join('; ');

    // me with the cookie forwarded explicitly → admin data
    const me = await request(handle.httpServer).get('/auth/admin/me').set('Cookie', cookieHeader);
    if (me.status !== 200) {
      // eslint-disable-next-line no-console
      console.error('[admin me failure]', me.status, 'cookie:', cookieHeader, JSON.stringify(me.body));
    }
    expect(me.status).toBe(200);
    expect(JSON.stringify(me.body)).toContain(email);
  });

  it('TC-312: admin login with wrong password → 401', async () => {
    const email = 'admin4@test.local';
    await request(handle.httpServer)
      .post('/auth/admin/signup')
      .send({ email, password: ADMIN_PASSWORD, secretKey: SECRET });

    const login = await request(handle.httpServer)
      .post('/auth/admin/login')
      .send({ email, password: 'WrongAdminPass!9' });
    expect(login.status).toBe(401);
  });

  it('admin /me without a session cookie → 401', async () => {
    const res = await request(handle.httpServer).get('/auth/admin/me');
    expect(res.status).toBe(401);
  });
});

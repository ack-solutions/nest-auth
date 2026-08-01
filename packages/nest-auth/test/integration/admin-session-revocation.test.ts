/**
 * Regression test for revocable admin sessions (audit #19).
 *
 * NO MOCKS. The admin session JWT carries the admin's tokenVersion; logout (and
 * password reset) bump it, so the SAME cookie stops working afterwards — proving
 * logout genuinely revokes the token rather than only clearing the browser cookie.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

const SECRET = 'admin-session-revocation-secret-key-01'; // 32+ chars
const PW = 'AdminPass!1word';

function cookieOf(res: request.Response): string {
  const set = res.headers['set-cookie'];
  return (Array.isArray(set) ? set : [set]).map((c) => c.split(';')[0]).join('; ');
}

describe('admin console — revocable sessions (#19)', () => {
  let handle: TestAppHandle;
  beforeEach(async () => {
    handle = await bootTestApp({ nestAuth: { adminConsole: { enabled: true, secretKey: SECRET } } as any });
  });
  afterEach(async () => { await handle.close(); });

  it('logout revokes the token — the same cookie no longer authenticates', async () => {
    const email = 'revoke-admin@test.local';
    const signup = await request(handle.httpServer)
      .post('/auth/admin/signup')
      .send({ email, password: PW, secretKey: SECRET });
    expect(signup.status).toBeLessThan(300);

    const login = await request(handle.httpServer).post('/auth/admin/login').send({ email, password: PW });
    expect(login.status).toBeLessThan(300);
    const cookie = cookieOf(login);

    // The captured cookie works.
    const before = await request(handle.httpServer).get('/auth/admin/me').set('Cookie', cookie);
    expect(before.status).toBe(200);

    // Logout (bumps tokenVersion server-side).
    const logout = await request(handle.httpServer).post('/auth/admin/logout').set('Cookie', cookie);
    expect(logout.status).toBeLessThan(300);

    // The SAME cookie is now rejected — the token was revoked, not just cleared.
    const after = await request(handle.httpServer).get('/auth/admin/me').set('Cookie', cookie);
    expect(after.status).toBe(401);
  });
});

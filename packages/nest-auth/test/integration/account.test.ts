/**
 * Real integration tests for authenticated account operations:
 *   GET  /auth/me              (TC-200-ish: guarded profile fetch)
 *   POST /auth/change-password (TC-165, TC-166)
 *   POST /auth/logout          (TC-127: session revoke)
 *
 * NO MOCKS. Real NestJS + real DB + real JWT guard.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

function bearer(body: any): string {
  const token = body?.accessToken ?? body?.tokens?.accessToken;
  if (!token) throw new Error(`no access token in body: ${JSON.stringify(body)}`);
  return token;
}

/** signup + return the access token */
async function signupAndGetToken(handle: TestAppHandle, email: string, password: string): Promise<string> {
  const res = await request(handle.httpServer).post('/auth/signup').send({ email, password });
  if (res.status >= 300) throw new Error(`signup failed (${res.status}): ${JSON.stringify(res.body)}`);
  return bearer(res.body);
}

describe('GET /auth/me — guarded profile fetch', () => {
  let handle: TestAppHandle;

  beforeEach(async () => {
    handle = await bootTestApp();
  });
  afterEach(async () => {
    await handle.close();
  });

  it('returns 401 without an auth token', async () => {
    const res = await request(handle.httpServer).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with a malformed token', async () => {
    const res = await request(handle.httpServer)
      .get('/auth/me')
      .set('Authorization', 'Bearer not-a-real-jwt');
    expect(res.status).toBe(401);
  });

  it('returns the current user with a valid token', async () => {
    const email = 'me@test.local';
    const token = await signupAndGetToken(handle, email, 'MePassword!1');

    const res = await request(handle.httpServer)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // ISessionUserData includes the user identity — email should round-trip
    const body = res.body;
    const emailInBody = JSON.stringify(body).includes(email);
    expect(emailInBody, `expected email in /me response: ${JSON.stringify(body)}`).toBe(true);
    // Never leak the password hash
    expect(JSON.stringify(body)).not.toContain('passwordHash');
  });
});

describe('POST /auth/change-password — TC-165, TC-166', () => {
  let handle: TestAppHandle;

  beforeEach(async () => {
    handle = await bootTestApp();
  });
  afterEach(async () => {
    await handle.close();
  });

  it('TC-165: changes password; new password works, old fails', async () => {
    const email = 'changepw@test.local';
    const oldPassword = 'OldChange!1';
    const newPassword = 'NewChange!2';
    const token = await signupAndGetToken(handle, email, oldPassword);

    const changeRes = await request(handle.httpServer)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: oldPassword, newPassword });

    if (changeRes.status >= 400) {
      // eslint-disable-next-line no-console
      console.error('[change-password failure]', changeRes.status, JSON.stringify(changeRes.body, null, 2));
    }
    expect(changeRes.status).toBeLessThan(300);

    // New password logs in
    const newLogin = await request(handle.httpServer)
      .post('/auth/login')
      .send({ providerName: 'email', credentials: { email, password: newPassword } });
    expect(newLogin.status).toBeLessThan(300);

    // Old password rejected
    const oldLogin = await request(handle.httpServer)
      .post('/auth/login')
      .send({ providerName: 'email', credentials: { email, password: oldPassword } });
    expect(oldLogin.status).toBe(401);
  });

  it('TC-166: wrong current password → 4xx', async () => {
    const email = 'changepw-wrong@test.local';
    const token = await signupAndGetToken(handle, email, 'CorrectCurrent!1');

    const res = await request(handle.httpServer)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'WrongCurrent!9', newPassword: 'SomethingNew!2' });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('rejects new password identical to current (DTO validation) → 400', async () => {
    const email = 'changepw-same@test.local';
    const password = 'SamePassword!1';
    const token = await signupAndGetToken(handle, email, password);

    const res = await request(handle.httpServer)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: password, newPassword: password });

    expect(res.status).toBe(400);
  });

  it('requires auth → 401 without token', async () => {
    const res = await request(handle.httpServer)
      .post('/auth/change-password')
      .send({ currentPassword: 'x', newPassword: 'y' });
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/logout — TC-127 session revoke', () => {
  let handle: TestAppHandle;

  beforeEach(async () => {
    handle = await bootTestApp();
  });
  afterEach(async () => {
    await handle.close();
  });

  it('logout succeeds with a valid token', async () => {
    const token = await signupAndGetToken(handle, 'logout@test.local', 'LogoutPass!1');

    const res = await request(handle.httpServer)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBeLessThan(300);
  });

  it('is idempotent — returns 200 even without a token (clears cookies regardless)', async () => {
    // logout uses @Auth(true) (optional auth) by design: it should always
    // succeed and clear cookies, even if the session is already dead.
    const res = await request(handle.httpServer).post('/auth/logout').send({});
    expect(res.status).toBe(200);
  });
});

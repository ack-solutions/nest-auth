/**
 * Regression tests for soft account lockout and the CAPTCHA hook.
 *
 * NO MOCKS. Real NestJS + real DB + real events. Lockout counts real
 * LOGIN_FAILED events; the CAPTCHA guard calls the real (test-supplied) verify().
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

const PW = 'LockPass!1';

describe('account lockout (soft)', () => {
  let handle: TestAppHandle;
  beforeEach(async () => {
    handle = await bootTestApp({
      nestAuth: {
        security: { lockout: { enabled: true, maxFailedAttempts: 3, window: '15m', lockDuration: '15m' } },
      } as any,
    });
  });
  afterEach(async () => { await handle.close(); });

  it('locks the account (429) after maxFailedAttempts, even for the correct password', async () => {
    const email = 'lock@test.local';
    await request(handle.httpServer).post('/auth/signup').send({ email, password: PW });

    const login = (password: string) =>
      request(handle.httpServer).post('/auth/login').send({ providerName: 'email', credentials: { email, password } });

    // 3 wrong attempts — each a normal 401 (and each counts a failure).
    for (let i = 0; i < 3; i++) expect((await login('WrongPass!9')).status).toBe(401);

    // Now locked: even the CORRECT password is rejected with 429 + Retry-After.
    const locked = await login(PW);
    expect(locked.status).toBe(429);
    expect(JSON.stringify(locked.body)).toContain('ACCOUNT_LOCKED');
    expect(locked.headers['retry-after']).toBeDefined();
  });

  it('a successful login resets the failure counter', async () => {
    const email = 'lock-reset@test.local';
    await request(handle.httpServer).post('/auth/signup').send({ email, password: PW });
    const login = (password: string) =>
      request(handle.httpServer).post('/auth/login').send({ providerName: 'email', credentials: { email, password } });

    expect((await login('WrongPass!9')).status).toBe(401);
    expect((await login('WrongPass!9')).status).toBe(401);
    expect((await login(PW)).status).toBeLessThan(300);       // success → resets

    // Two more failures don't lock (counter was cleared; under the cap of 3).
    expect((await login('WrongPass!9')).status).toBe(401);
    expect((await login('WrongPass!9')).status).toBe(401);
  });
});

describe('CAPTCHA hook', () => {
  let handle: TestAppHandle;
  beforeEach(async () => {
    handle = await bootTestApp({
      nestAuth: {
        security: { captcha: { enabled: true, verify: (token: string) => token === 'good-token' } },
      } as any,
    });
  });
  afterEach(async () => { await handle.close(); });

  it('requires a token on signup (CAPTCHA_REQUIRED)', async () => {
    const res = await request(handle.httpServer).post('/auth/signup').send({ email: 'cap-none@test.local', password: PW });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('CAPTCHA_REQUIRED');
  });

  it('rejects an invalid token (CAPTCHA_FAILED)', async () => {
    const res = await request(handle.httpServer)
      .post('/auth/signup')
      .set('x-captcha-token', 'bad')
      .send({ email: 'cap-bad@test.local', password: PW });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('CAPTCHA_FAILED');
  });

  it('accepts a valid token', async () => {
    const res = await request(handle.httpServer)
      .post('/auth/signup')
      .set('x-captcha-token', 'good-token')
      .send({ email: 'cap-ok@test.local', password: PW });
    expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);
  });
});

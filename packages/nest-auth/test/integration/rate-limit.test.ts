/**
 * Regression tests for rate limiting on sensitive endpoints (security.rateLimit).
 *
 * NO MOCKS. Real NestJS + real DB + the real in-memory rate-limit store. We drive
 * a tight bucket over HTTP and assert the 429 + Retry-After once the limit is hit.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

const PW = 'RatePass!1';

describe('rate limiting — login bucket (keyBy: both)', () => {
  let handle: TestAppHandle;
  beforeEach(async () => {
    handle = await bootTestApp({
      nestAuth: {
        security: { rateLimit: { enabled: true, buckets: { login: { windowMs: 60_000, max: 2 } } } } as any,
      },
    });
  });
  afterEach(async () => { await handle.close(); });

  it('returns 429 with Retry-After after the login limit is exceeded', async () => {
    const email = 'rl-login@test.local';
    await request(handle.httpServer).post('/auth/signup').send({ email, password: PW });

    const attempt = () =>
      request(handle.httpServer)
        .post('/auth/login')
        .send({ providerName: 'email', credentials: { email, password: 'WrongPass!9' } });

    expect((await attempt()).status).toBe(401); // 1 — allowed (bad creds)
    expect((await attempt()).status).toBe(401); // 2 — allowed
    const third = await attempt();               // 3 — over the limit
    expect(third.status).toBe(429);
    expect(JSON.stringify(third.body)).toContain('RATE_LIMITED');
    expect(third.headers['retry-after']).toBeDefined();
  });
});

describe('rate limiting — identifier isolation (keyBy: identifier)', () => {
  let handle: TestAppHandle;
  beforeEach(async () => {
    handle = await bootTestApp({
      nestAuth: {
        security: {
          rateLimit: { enabled: true, keyBy: 'identifier', buckets: { login: { windowMs: 60_000, max: 2 } } },
        } as any,
      },
    });
  });
  afterEach(async () => { await handle.close(); });

  it('limits one account without blocking a different account', async () => {
    const login = (email: string) =>
      request(handle.httpServer)
        .post('/auth/login')
        .send({ providerName: 'email', credentials: { email, password: 'WrongPass!9' } });

    // Exhaust account A (2 allowed, 3rd blocked).
    expect((await login('rl-a@test.local')).status).toBe(401);
    expect((await login('rl-a@test.local')).status).toBe(401);
    expect((await login('rl-a@test.local')).status).toBe(429);

    // A different identifier has its own bucket — not blocked.
    expect((await login('rl-b@test.local')).status).toBe(401);
  });
});

describe('rate limiting — disabled by default', () => {
  let handle: TestAppHandle;
  beforeEach(async () => { handle = await bootTestApp(); });
  afterEach(async () => { await handle.close(); });

  it('does not 429 without security.rateLimit.enabled', async () => {
    const login = () =>
      request(handle.httpServer)
        .post('/auth/login')
        .send({ providerName: 'email', credentials: { email: 'rl-off@test.local', password: 'WrongPass!9' } });
    for (let i = 0; i < 8; i++) {
      const res = await login();
      expect(res.status).not.toBe(429);
    }
  });
});

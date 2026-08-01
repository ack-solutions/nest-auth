/**
 * Regression tests for admin-console transport hardening:
 *   - anti-clickjacking + hardening response headers on every admin route
 *   - Secure-by-default admin session cookie (fails safe unless NODE_ENV=dev/test)
 *
 * NO MOCKS. Real NestJS + real DB + real HTTP responses via supertest.
 */
import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

const SECRET = 'admin-security-headers-secret-key-00001'; // 32+ chars
const PW = 'AdminPass!1word';

async function boot(): Promise<TestAppHandle> {
  return bootTestApp({ nestAuth: { adminConsole: { enabled: true, secretKey: SECRET } } as any });
}

function expectHardened(headers: Record<string, string | undefined>) {
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('no-referrer');
  const csp = headers['content-security-policy'] ?? '';
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("base-uri 'self'");
}

describe('admin console — security response headers', () => {
  it('sets anti-clickjacking + hardening headers on the SPA shell route', async () => {
    const handle = await boot();
    try {
      const res = await request(handle.httpServer).get('/auth/admin');
      // Whether the bundle is present (200) or not (404), the middleware runs.
      expectHardened(res.headers);
    } finally {
      await handle.close();
    }
  });

  it('sets the same headers on admin API routes (public /config)', async () => {
    const handle = await boot();
    try {
      const res = await request(handle.httpServer).get('/auth/admin/config');
      expect(res.status).toBe(200);
      expectHardened(res.headers);
    } finally {
      await handle.close();
    }
  });

  it('sets the headers on guarded admin API routes too (401 path)', async () => {
    const handle = await boot();
    try {
      const res = await request(handle.httpServer).get('/auth/admin/api/stats');
      expect(res.status).toBe(401); // unauthenticated
      expectHardened(res.headers);
    } finally {
      await handle.close();
    }
  });
});

describe('admin console — Secure cookie default', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('does NOT mark the cookie Secure under NODE_ENV=test (local dev leg)', async () => {
    process.env.NODE_ENV = 'test';
    const handle = await boot();
    try {
      await request(handle.httpServer)
        .post('/auth/admin/signup')
        .send({ email: 'sec-cookie@test.local', password: PW, secretKey: SECRET });
      const login = await request(handle.httpServer)
        .post('/auth/admin/login')
        .send({ email: 'sec-cookie@test.local', password: PW });
      expect(login.status).toBeLessThan(300);
      const setCookie = String(login.headers['set-cookie'] ?? '');
      expect(setCookie).toContain('nest_auth_admin=');
      expect(setCookie.toLowerCase()).not.toContain('secure');
    } finally {
      await handle.close();
    }
  });

  it('marks the cookie Secure when NODE_ENV is unset/other (fails safe)', async () => {
    process.env.NODE_ENV = 'staging';
    const handle = await boot();
    try {
      await request(handle.httpServer)
        .post('/auth/admin/signup')
        .send({ email: 'sec-cookie2@test.local', password: PW, secretKey: SECRET });
      const login = await request(handle.httpServer)
        .post('/auth/admin/login')
        .send({ email: 'sec-cookie2@test.local', password: PW });
      expect(login.status).toBeLessThan(300);
      const setCookie = String(login.headers['set-cookie'] ?? '');
      expect(setCookie.toLowerCase()).toContain('secure');
    } finally {
      await handle.close();
    }
  });
});

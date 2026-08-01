/**
 * Regression tests for admin-login brute-force protection (on by default) and
 * timing-based email enumeration.
 *
 * NO MOCKS. Real NestJS + real DB + real argon2 + real HTTP via supertest.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

const SECRET = 'admin-brute-force-secret-key-000000001'; // 32+ chars
const PW = 'AdminPass!1word';

async function bootWithAdmin(extra: Record<string, unknown> = {}): Promise<TestAppHandle> {
  const handle = await bootTestApp({
    nestAuth: { adminConsole: { enabled: true, secretKey: SECRET, ...extra } } as any,
  });
  await request(handle.httpServer)
    .post('/auth/admin/signup')
    .send({ email: 'bf-admin@test.local', password: PW, secretKey: SECRET });
  return handle;
}

describe('admin login — brute-force throttle ON by default', () => {
  it('throttles rapid failed logins with 429 even when security.rateLimit is not enabled', async () => {
    const handle = await bootWithAdmin();
    try {
      const statuses: number[] = [];
      // Default adminLogin bucket = 5 per 60s. The 6th+ wrong attempt should 429.
      for (let i = 0; i < 8; i++) {
        const res = await request(handle.httpServer)
          .post('/auth/admin/login')
          .send({ email: 'bf-admin@test.local', password: 'wrong-password' });
        statuses.push(res.status);
      }
      expect(statuses.filter((s) => s === 401).length).toBeGreaterThanOrEqual(1);
      expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(1);
    } finally {
      await handle.close();
    }
  });

  it('can be disabled with adminConsole.bruteForce.enabled=false', async () => {
    const handle = await bootWithAdmin({ bruteForce: { enabled: false } });
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 8; i++) {
        const res = await request(handle.httpServer)
          .post('/auth/admin/login')
          .send({ email: 'bf-admin@test.local', password: 'wrong-password' });
        statuses.push(res.status);
      }
      // No throttle → all attempts reach credential validation (401), none 429.
      expect(statuses.every((s) => s === 401)).toBe(true);
    } finally {
      await handle.close();
    }
  });

  it('a correct login still succeeds under the default throttle (within the window budget)', async () => {
    const handle = await bootWithAdmin();
    try {
      const res = await request(handle.httpServer)
        .post('/auth/admin/login')
        .send({ email: 'bf-admin@test.local', password: PW });
      expect(res.status).toBeLessThan(300);
    } finally {
      await handle.close();
    }
  });
});

describe('admin login — no email enumeration', () => {
  it('returns the same 401 shape for a wrong password and a non-existent admin', async () => {
    const handle = await bootWithAdmin({ bruteForce: { enabled: false } }); // avoid throttle noise
    try {
      const wrongPw = await request(handle.httpServer)
        .post('/auth/admin/login')
        .send({ email: 'bf-admin@test.local', password: 'wrong-password' });
      const noSuchAdmin = await request(handle.httpServer)
        .post('/auth/admin/login')
        .send({ email: 'does-not-exist@test.local', password: 'wrong-password' });

      expect(wrongPw.status).toBe(401);
      expect(noSuchAdmin.status).toBe(401);
      // Identical generic message — no "unknown user" vs "bad password" distinction.
      expect(JSON.stringify(noSuchAdmin.body)).toBe(JSON.stringify(wrongPw.body));
    } finally {
      await handle.close();
    }
  });
});

/**
 * Regression tests for the secret-key-gated admin endpoints (signup / reset):
 *   - post-bootstrap signup is a NON-oracle (right vs wrong key indistinguishable)
 *   - both endpoints are throttled by default (secret-key guessing is capped)
 *
 * NO MOCKS. Real NestJS + real DB + real HTTP via supertest.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

const SECRET = 'admin-secret-endpoints-key-0000000001'; // 32+ chars
const PW = 'AdminPass!1word';

async function bootWithAdmin(extra: Record<string, unknown> = {}): Promise<TestAppHandle> {
  const handle = await bootTestApp({
    nestAuth: { adminConsole: { enabled: true, secretKey: SECRET, ...extra } } as any,
  });
  await request(handle.httpServer)
    .post('/auth/admin/signup')
    .send({ email: 'root-admin@test.local', password: PW, secretKey: SECRET });
  return handle;
}

describe('admin signup — no secret-key oracle after bootstrap', () => {
  it('returns ADMIN_BOOTSTRAP_CLOSED for BOTH a wrong and a correct key once an admin exists', async () => {
    // Disable the throttle so we compare the bootstrap-closed responses directly.
    const handle = await bootWithAdmin({ bruteForce: { enabled: false } });
    try {
      const wrongKey = await request(handle.httpServer)
        .post('/auth/admin/signup')
        .send({ email: 'x1@test.local', password: PW, secretKey: 'totally-wrong-key-but-32-characters-1' });
      const rightKey = await request(handle.httpServer)
        .post('/auth/admin/signup')
        .send({ email: 'x2@test.local', password: PW, secretKey: SECRET });

      expect(wrongKey.status).toBe(403);
      expect(rightKey.status).toBe(403);
      expect(JSON.stringify(wrongKey.body)).toContain('ADMIN_BOOTSTRAP_CLOSED');
      // Indistinguishable: a wrong key no longer yields INVALID_SECRET_KEY while a
      // correct key yields BOOTSTRAP_CLOSED — both are the same closed response.
      expect(JSON.stringify(wrongKey.body)).toBe(JSON.stringify(rightKey.body));
    } finally {
      await handle.close();
    }
  });
});

describe('admin secret-key endpoints — throttled by default', () => {
  it('throttles rapid reset-password key guesses with 429', async () => {
    const handle = await bootWithAdmin();
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 8; i++) {
        const res = await request(handle.httpServer)
          .post('/auth/admin/reset-password')
          .send({ email: 'root-admin@test.local', newPassword: PW, secretKey: `guess-${i}-padding-to-32-characters-xx` });
        statuses.push(res.status);
      }
      // Wrong key → 401 until the strict adminReset budget is exhausted → 429.
      expect(statuses.filter((s) => s === 401).length).toBeGreaterThanOrEqual(1);
      expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(1);
    } finally {
      await handle.close();
    }
  });
});

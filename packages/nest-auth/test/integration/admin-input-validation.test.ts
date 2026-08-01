/**
 * Regression tests for admin input hardening:
 *   - admin password floor enforced through EVERY path (entity backstop, so it
 *     holds even with no ValidationPipe and no opt-in policy)
 *   - blocked-domains bulk add is capped (ArrayMaxSize)
 *
 * NO MOCKS. Real NestJS + real DB + real argon2.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { AdminUserService } from '../../src/lib/admin-console/services/admin-user.service';

const SECRET = 'admin-input-validation-key-0000000001'; // 32+ chars
const PW = 'AdminPass!1word';

async function boot(): Promise<TestAppHandle> {
  return bootTestApp({ nestAuth: { adminConsole: { enabled: true, secretKey: SECRET } } as any });
}

describe('admin password floor (entity backstop, pipe-independent)', () => {
  it('rejects a too-short admin password even via the service (no HTTP pipe involved)', async () => {
    const handle = await boot();
    try {
      const svc = handle.get(AdminUserService);
      await expect(svc.createAdmin({ email: 'weak@test.local', password: 'Ab1!' })).rejects.toThrow(
        /at least 8 characters/i,
      );
    } finally {
      await handle.close();
    }
  });

  it('accepts an adequately long admin password', async () => {
    const handle = await boot();
    try {
      const svc = handle.get(AdminUserService);
      const admin = await svc.createAdmin({ email: 'ok@test.local', password: 'ValidPass1!' });
      expect(admin.id).toBeTruthy();
    } finally {
      await handle.close();
    }
  });
});

describe('blocked-domains bulk add — capped', () => {
  async function adminCookie(handle: TestAppHandle): Promise<string> {
    await request(handle.httpServer)
      .post('/auth/admin/signup')
      .send({ email: 'dom-admin@test.local', password: PW, secretKey: SECRET });
    const login = await request(handle.httpServer)
      .post('/auth/admin/login')
      .send({ email: 'dom-admin@test.local', password: PW });
    const setCookie = login.headers['set-cookie'];
    return (Array.isArray(setCookie) ? setCookie : [setCookie]).map((c) => c.split(';')[0]).join('; ');
  }

  it('rejects an oversized domains[] (>1000) with 400', async () => {
    const handle = await boot();
    try {
      const cookie = await adminCookie(handle);
      const domains = Array.from({ length: 1001 }, (_, i) => `d${i}.example.com`);
      const res = await request(handle.httpServer)
        .post('/auth/admin/api/blocked-email-domains')
        .set('Cookie', cookie)
        .send({ domains });
      expect(res.status).toBe(400);
    } finally {
      await handle.close();
    }
  });

  it('accepts a reasonable domains[] batch', async () => {
    const handle = await boot();
    try {
      const cookie = await adminCookie(handle);
      const res = await request(handle.httpServer)
        .post('/auth/admin/api/blocked-email-domains')
        .set('Cookie', cookie)
        .send({ domains: ['mailinator.com', 'guerrillamail.com'] });
      expect(res.status).toBeLessThan(300);
    } finally {
      await handle.close();
    }
  });
});

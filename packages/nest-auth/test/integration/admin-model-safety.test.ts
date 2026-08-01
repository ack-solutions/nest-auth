/**
 * Regression tests for admin-model safety:
 *   - the last remaining admin cannot be deleted (avoids console lockout)
 *   - changing an admin's password revokes their outstanding sessions
 *
 * NO MOCKS. Real NestJS + real DB + real admin JWT sessions.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { AdminUserService } from '../../src/lib/admin-console/services/admin-user.service';

const SECRET = 'admin-model-safety-secret-key-00000001'; // 32+ chars
const PW = 'AdminPass!1word';

async function boot(): Promise<TestAppHandle> {
  return bootTestApp({ nestAuth: { adminConsole: { enabled: true, secretKey: SECRET } } as any });
}

describe('admin model — last-admin deletion guard', () => {
  it('refuses to delete the only admin, allows deletion once a second exists', async () => {
    const handle = await boot();
    try {
      const svc = handle.get(AdminUserService);
      const first = await svc.createAdmin({ email: 'first@test.local', password: PW });

      await expect(svc.deleteAdmin(first.id)).rejects.toThrow(/last remaining admin/i);

      const second = await svc.createAdmin({ email: 'second@test.local', password: PW });
      await expect(svc.deleteAdmin(first.id)).resolves.toBeUndefined();
      // second still there → still can't delete the (now) last one
      await expect(svc.deleteAdmin(second.id)).rejects.toThrow(/last remaining admin/i);
    } finally {
      await handle.close();
    }
  });
});

describe('admin model — password change revokes sessions', () => {
  it('invalidates an existing session cookie when the admin password is changed', async () => {
    const handle = await boot();
    try {
      const email = 'rotate@test.local';
      await request(handle.httpServer)
        .post('/auth/admin/signup')
        .send({ email, password: PW, secretKey: SECRET });

      const login = await request(handle.httpServer).post('/auth/admin/login').send({ email, password: PW });
      const setCookie = login.headers['set-cookie'];
      const cookie = (Array.isArray(setCookie) ? setCookie : [setCookie]).map((c) => c.split(';')[0]).join('; ');

      // Cookie works before the change.
      const before = await request(handle.httpServer).get('/auth/admin/me').set('Cookie', cookie);
      expect(before.status).toBe(200);

      // Change the password via the service (as the dashboard update path does).
      const svc = handle.get(AdminUserService);
      const admin = await svc.findByEmail(email);
      await svc.updateAdmin(admin!.id, { password: 'RotatedPass!2' });

      // The pre-change cookie is now revoked.
      const after = await request(handle.httpServer).get('/auth/admin/me').set('Cookie', cookie);
      expect(after.status).toBe(401);
    } finally {
      await handle.close();
    }
  });
});

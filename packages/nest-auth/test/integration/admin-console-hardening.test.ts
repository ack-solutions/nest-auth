/**
 * Regression tests for the admin-console hardening (audit #4 / #5).
 *
 * NO MOCKS. Real NestJS + real DB + real admin JWT sessions. Each test boots the
 * app with a specific adminConsole config (configs differ per case).
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { NestAuthEvents } from '../../src/lib/auth.constants';

const SECRET = 'admin-console-hardening-secret-key-0001'; // 32+ chars (no strength warning)
const PW = 'AdminPass!1word';

async function boot(adminConsole: Record<string, unknown>): Promise<TestAppHandle> {
  return bootTestApp({ nestAuth: { adminConsole: { enabled: true, secretKey: SECRET, ...adminConsole } } as any });
}

describe('admin console — bootstrap-only signup (#4)', () => {
  it('refuses a SECOND secret-key signup once an admin exists (default)', async () => {
    const handle = await boot({});
    try {
      const first = await request(handle.httpServer)
        .post('/auth/admin/signup')
        .send({ email: 'boot-1@test.local', password: PW, secretKey: SECRET });
      expect(first.status).toBeLessThan(300);

      const second = await request(handle.httpServer)
        .post('/auth/admin/signup')
        .send({ email: 'boot-2@test.local', password: PW, secretKey: SECRET });
      expect(second.status).toBe(403);
      expect(JSON.stringify(second.body)).toContain('ADMIN_BOOTSTRAP_CLOSED');
    } finally {
      await handle.close();
    }
  });

  it('allows additional secret-key signups when allowPublicSignupAfterFirstAdmin is true', async () => {
    const handle = await boot({ allowPublicSignupAfterFirstAdmin: true });
    try {
      const first = await request(handle.httpServer)
        .post('/auth/admin/signup')
        .send({ email: 'multi-1@test.local', password: PW, secretKey: SECRET });
      expect(first.status).toBeLessThan(300);

      const second = await request(handle.httpServer)
        .post('/auth/admin/signup')
        .send({ email: 'multi-2@test.local', password: PW, secretKey: SECRET });
      expect(second.status).toBeLessThan(300);
    } finally {
      await handle.close();
    }
  });
});

describe('admin console — allowAdminManagement gate (#4)', () => {
  it('refuses signup AND reset-password when allowAdminManagement is false', async () => {
    const handle = await boot({ allowAdminManagement: false });
    try {
      const signup = await request(handle.httpServer)
        .post('/auth/admin/signup')
        .send({ email: 'gated@test.local', password: PW, secretKey: SECRET });
      expect(signup.status).toBe(403);
      expect(JSON.stringify(signup.body)).toContain('ADMIN_MANAGEMENT_DISABLED');

      const reset = await request(handle.httpServer)
        .post('/auth/admin/reset-password')
        .send({ email: 'gated@test.local', newPassword: 'Whatever!123', secretKey: SECRET });
      expect(reset.status).toBe(403);
      expect(JSON.stringify(reset.body)).toContain('ADMIN_MANAGEMENT_DISABLED');
    } finally {
      await handle.close();
    }
  });
});

describe('admin console — dedicated session secret (#5)', () => {
  it('signs and verifies the admin session with a sessionSecret distinct from secretKey', async () => {
    const handle = await boot({ sessionSecret: 'admin-console-DEDICATED-session-secret-0002' });
    try {
      const email = 'sess@test.local';
      const signup = await request(handle.httpServer)
        .post('/auth/admin/signup')
        .send({ email, password: PW, secretKey: SECRET });
      expect(signup.status).toBeLessThan(300);

      const login = await request(handle.httpServer).post('/auth/admin/login').send({ email, password: PW });
      expect(login.status).toBeLessThan(300);
      const setCookie = login.headers['set-cookie'];
      const cookie = (Array.isArray(setCookie) ? setCookie : [setCookie]).map((c) => c.split(';')[0]).join('; ');

      const me = await request(handle.httpServer).get('/auth/admin/me').set('Cookie', cookie);
      expect(me.status).toBe(200);
      expect(JSON.stringify(me.body)).toContain(email);
    } finally {
      await handle.close();
    }
  });

  it('derives a signing key DISTINCT from secretKey when no sessionSecret is set', async () => {
    const { AdminConsoleConfigService } = await import(
      '../../src/lib/admin-console/services/admin-console-config.service'
    );
    const handle = await boot({}); // secretKey only, no dedicated sessionSecret
    try {
      const cfg = handle.get(AdminConsoleConfigService);
      const signingKey = cfg.getSessionSecret();
      // The wire-transmitted setup key must NOT itself be the cookie-signing key.
      expect(signingKey).not.toBe(SECRET);
      expect(signingKey).toMatch(/^[0-9a-f]{64}$/); // sha256 hex digest
    } finally {
      await handle.close();
    }
  });

  it('uses a dedicated sessionSecret verbatim when provided', async () => {
    const { AdminConsoleConfigService } = await import(
      '../../src/lib/admin-console/services/admin-console-config.service'
    );
    const dedicated = 'admin-console-DEDICATED-session-secret-0003';
    const handle = await boot({ sessionSecret: dedicated });
    try {
      const cfg = handle.get(AdminConsoleConfigService);
      expect(cfg.getSessionSecret()).toBe(dedicated);
    } finally {
      await handle.close();
    }
  });
});

describe('admin console — OOB notification events (#4)', () => {
  it('emits ADMIN_CREATED on the bootstrap signup', async () => {
    const handle = await boot({});
    try {
      const emitter = handle.get(EventEmitter2);
      let payload: any = null;
      emitter.on(NestAuthEvents.ADMIN_CREATED, (p: any) => { payload = p; });

      const email = 'evt@test.local';
      const res = await request(handle.httpServer)
        .post('/auth/admin/signup')
        .send({ email, password: PW, secretKey: SECRET });
      expect(res.status).toBeLessThan(300);

      // emitAsync is awaited before the response returns.
      expect(payload, 'ADMIN_CREATED should have fired').toBeTruthy();
      expect(payload.email).toBe(email);
    } finally {
      await handle.close();
    }
  });
});

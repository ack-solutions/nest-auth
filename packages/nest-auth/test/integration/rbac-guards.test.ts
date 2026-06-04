/**
 * Real integration tests for RBAC guards (TC-200..TC-205).
 *
 * NO MOCKS. A real guarded controller is mounted into the test app; we drive it
 * over real HTTP with real JWTs and assert the NestAuthAuthGuard enforces
 * authentication, roles, and permissions.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Controller, Get } from '@nestjs/common';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { Auth } from '../../src/lib/core/decorators/auth.decorator';
import { NestAuthRoles } from '../../src/lib/core/decorators/role.decorator';
import { NestAuthPermissions } from '../../src/lib/core/decorators/permissions.decorator';

/**
 * Real controller with a route per guard scenario. Defined in the test file and
 * mounted via bootTestApp's extraControllers — it's production-shaped code, not
 * a mock.
 */
@Controller('test-rbac')
class TestRbacController {
  @Get('public')
  publicRoute() {
    return { ok: 'public' };
  }

  @Get('protected')
  @Auth()
  protectedRoute() {
    return { ok: 'protected' };
  }

  @Get('admin-only')
  @Auth()
  @NestAuthRoles(['admin'])
  adminOnly() {
    return { ok: 'admin' };
  }

  @Get('needs-permission')
  @Auth()
  @NestAuthPermissions(['users.read'])
  needsPermission() {
    return { ok: 'perm' };
  }
}

async function signupToken(handle: TestAppHandle, email: string): Promise<string> {
  const res = await request(handle.httpServer)
    .post('/auth/signup')
    .send({ email, password: 'RbacPassword!1' });
  if (res.status >= 300) throw new Error(`signup failed: ${JSON.stringify(res.body)}`);
  return res.body.accessToken ?? res.body.tokens?.accessToken;
}

describe('RBAC guards — TC-200..TC-205', () => {
  let handle: TestAppHandle;

  beforeAll(async () => {
    handle = await bootTestApp({ extraControllers: [TestRbacController] });
  });

  afterAll(async () => {
    await handle.close();
  });

  describe('TC-213: public route', () => {
    it('allows access without any token', async () => {
      const res = await request(handle.httpServer).get('/test-rbac/public');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe('public');
    });
  });

  describe('TC-200/TC-201: @Auth() guard', () => {
    it('TC-201: rejects request with no token → 401', async () => {
      const res = await request(handle.httpServer).get('/test-rbac/protected');
      expect(res.status).toBe(401);
    });

    it('TC-201: rejects request with malformed token → 401', async () => {
      const res = await request(handle.httpServer)
        .get('/test-rbac/protected')
        .set('Authorization', 'Bearer garbage.token.here');
      expect(res.status).toBe(401);
    });

    it('TC-200: allows request with a valid token → 200', async () => {
      const token = await signupToken(handle, 'rbac-protected@test.local');
      const res = await request(handle.httpServer)
        .get('/test-rbac/protected')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe('protected');
    });
  });

  describe('TC-204: @NestAuthRoles deny path', () => {
    it('rejects authenticated user WITHOUT the required role → 403', async () => {
      const token = await signupToken(handle, 'rbac-norole@test.local');
      const res = await request(handle.httpServer)
        .get('/test-rbac/admin-only')
        .set('Authorization', `Bearer ${token}`);
      // Authenticated but lacks 'admin' role → forbidden
      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated request to a role-guarded route → 401', async () => {
      const res = await request(handle.httpServer).get('/test-rbac/admin-only');
      expect(res.status).toBe(401);
    });
  });

  describe('TC-205: @NestAuthPermissions deny path', () => {
    it('rejects authenticated user WITHOUT the required permission → 403', async () => {
      const token = await signupToken(handle, 'rbac-noperm@test.local');
      const res = await request(handle.httpServer)
        .get('/test-rbac/needs-permission')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });
  });
});

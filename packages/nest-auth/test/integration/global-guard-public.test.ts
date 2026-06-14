/**
 * Real integration tests for the global-guard + @Public() pattern.
 *
 * Reported bug (2.0.3): @Public() set IS_PUBLIC_KEY but the guard never read it,
 * so @Public() was a silent no-op — and a global APP_GUARD: NestAuthAuthGuard
 * 401'd everything including the library's own /auth/login & /auth/signup.
 *
 * These tests mount a REAL consumer controller under a REAL global APP_GUARD and
 * drive it over real HTTP. NO MOCKS.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Controller, Get } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { NestAuthAuthGuard } from '../../src/lib/auth/guards/auth.guard';
import { Public, IS_PUBLIC_KEY } from '../../src/lib/core/decorators/public.decorator';
import { AuthController } from '../../src/lib/auth/controllers/auth.controller';

// A consumer controller running UNDER a global guard. No decorator → protected
// by the global guard; @Public() → opted out.
@Controller('app')
class ConsumerController {
  @Get('protected')
  protectedRoute() {
    return { ok: 'protected' };
  }

  @Get('open')
  @Public()
  openRoute() {
    return { ok: 'open' };
  }
}

describe('global APP_GUARD + @Public() opt-out', () => {
  let handle: TestAppHandle;

  beforeAll(async () => {
    handle = await bootTestApp({
      extraControllers: [ConsumerController],
      // The exact pattern from the docs: apply the auth guard app-wide.
      extraProviders: [{ provide: APP_GUARD, useClass: NestAuthAuthGuard }],
    });
  });

  afterAll(async () => {
    await handle.close();
  });

  it("library public routes (signup/login) are reachable WITHOUT a token under a global guard", async () => {
    const signup = await request(handle.httpServer)
      .post('/auth/signup')
      .send({ email: 'gg@b.test', password: 'GlobalGuard!1' });
    expect(signup.status).toBeLessThan(300); // would be 401 if @Public were ignored

    const login = await request(handle.httpServer)
      .post('/auth/login')
      .send({ providerName: 'email', credentials: { email: 'gg@b.test', password: 'GlobalGuard!1' } });
    expect(login.status).toBeLessThan(300); // 200, not 401 — @Public let it reach the handler
  });

  it('a consumer @Public() route is reachable without a token (proves @Public() now works)', async () => {
    const res = await request(handle.httpServer).get('/app/open');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: 'open' });
  });

  it('a consumer route with no opt-out is blocked by the global guard (401)', async () => {
    const res = await request(handle.httpServer).get('/app/protected');
    expect(res.status).toBe(401);
  });

  it('the same protected consumer route works WITH a valid token', async () => {
    const signup = await request(handle.httpServer)
      .post('/auth/signup')
      .send({ email: 'gg2@b.test', password: 'GlobalGuard!1' });
    const token = signup.body.accessToken ?? signup.body.tokens?.accessToken;
    expect(token).toBeTruthy();

    const res = await request(handle.httpServer)
      .get('/app/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: 'protected' });
  });

  it("the library's own protected route (/auth/user) is still 401 without a token", async () => {
    const res = await request(handle.httpServer).get('/auth/user');
    expect(res.status).toBe(401);
  });
});

describe("@Public() markers are present on the library's public surface", () => {
  const reflector = new Reflector();

  it('auth controller marks its public routes (login, signup, refresh, forgot/reset)', () => {
    const proto = AuthController.prototype as any;
    for (const method of ['login', 'signup', 'refreshToken', 'forgotPassword', 'resetPassword', 'getClientConfig']) {
      expect(
        reflector.get<boolean>(IS_PUBLIC_KEY, proto[method]),
        `AuthController.${method} should be @Public()`,
      ).toBe(true);
    }
  });

  it('admin console controllers are class-level @Public() (global-guard-proof; AdminSessionGuard still guards them)', async () => {
    const mods = await Promise.all([
      import('../../src/lib/admin-console/controllers/admin-auth.controller'),
      import('../../src/lib/admin-console/controllers/admin-console.controller'),
      import('../../src/lib/admin-console/controllers/admin-users.controller'),
      import('../../src/lib/admin-console/controllers/admin-roles.controller'),
      import('../../src/lib/admin-console/controllers/admin-permissions.controller'),
      import('../../src/lib/admin-console/controllers/admin-tenants.controller'),
    ]);
    const classes = [
      mods[0].AdminAuthController,
      mods[1].AdminConsoleController,
      mods[2].AdminUsersController,
      mods[3].AdminRolesController,
      mods[4].AdminPermissionsController,
      mods[5].AdminTenantsController,
    ];
    for (const cls of classes) {
      expect(reflector.get<boolean>(IS_PUBLIC_KEY, cls), `${cls.name} should be class-level @Public()`).toBe(true);
    }
  });
});

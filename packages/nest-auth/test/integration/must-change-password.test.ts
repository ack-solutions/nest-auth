/**
 * Real integration tests for mustChangePassword (force-change-password).
 *
 * The flag is always surfaced (login response + /auth/me) and cleared on a
 * successful change. With `mustChangePassword.enforce: true`, a flagged user is
 * HARD-BLOCKED at the guard (403 MUST_CHANGE_PASSWORD) on every guarded route
 * EXCEPT the allowlist (change-password / logout / current-user / MFA /
 * verification) — so a direct API call can't bypass the change with the temp
 * credential. NO MOCKS.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Controller, Get } from '@nestjs/common';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { Auth } from '../../src/lib/core/decorators/auth.decorator';
import { UserService } from '../../src';

@Controller('app')
class ProtectedController {
  @Get('ping')
  @Auth()
  ping() {
    return { ok: true };
  }
}

const PW = 'TempPass!1';
const tokenOf = (b: any): string => b?.accessToken ?? b?.tokens?.accessToken;
const subOf = (t: string): string => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString('utf8')).sub;

async function signup(handle: TestAppHandle, email: string) {
  const r = await request(handle.httpServer).post('/auth/signup').send({ email, password: PW });
  const t = tokenOf(r.body);
  return { token: t, userId: subOf(t) };
}
const login = (handle: TestAppHandle, email: string, password: string) =>
  request(handle.httpServer).post('/auth/login').send({ providerName: 'email', credentials: { email, password } });

describe('mustChangePassword — enforce: true (hard-block + surfaced flag)', () => {
  let handle: TestAppHandle;

  beforeAll(async () => {
    handle = await bootTestApp({
      nestAuth: { mustChangePassword: { enforce: true } } as any,
      extraControllers: [ProtectedController],
    });
  });
  afterAll(async () => {
    await handle.close();
  });

  it('blocks non-allowlist routes (403), allows the allowlist + surfaces the flag, and clearing it unblocks', async () => {
    const email = 'mcp@test.local';
    const { userId } = await signup(handle, email);
    await handle.get<UserService>(UserService).updateUser(userId, { mustChangePassword: true });

    // Login AFTER the flag is set → the response surfaces it.
    const li = await login(handle, email, PW);
    expect(li.status).toBeLessThan(300);
    expect(li.body.mustChangePassword).toBe(true);
    const t = tokenOf(li.body);

    // Allowlist: /auth/user works AND surfaces the flag.
    const me = await request(handle.httpServer).get('/auth/user').set('Authorization', `Bearer ${t}`);
    expect(me.status).toBe(200);
    expect(me.body.mustChangePassword).toBe(true);

    // Non-allowlist: hard-blocked with the typed code.
    const blocked = await request(handle.httpServer).get('/app/ping').set('Authorization', `Bearer ${t}`);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('MUST_CHANGE_PASSWORD');

    // change-password is on the allowlist → reachable, and clears the flag.
    const change = await request(handle.httpServer)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${t}`)
      .send({ currentPassword: PW, newPassword: 'NewPass!2' });
    expect(change.status).toBeLessThan(300);

    // Re-login (the change revoked sessions): flag gone, protected route now works.
    const li2 = await login(handle, email, 'NewPass!2');
    expect(li2.body.mustChangePassword).toBeFalsy();
    const ok = await request(handle.httpServer).get('/app/ping').set('Authorization', `Bearer ${tokenOf(li2.body)}`);
    expect(ok.status).toBe(200);
  });
});

describe('mustChangePassword — enforce off (surface-only)', () => {
  let handle: TestAppHandle;

  beforeAll(async () => {
    handle = await bootTestApp({ extraControllers: [ProtectedController] });
  });
  afterAll(async () => {
    await handle.close();
  });

  it('surfaces the flag but does NOT block (UI-only)', async () => {
    const email = 'mcp-soft@test.local';
    const { userId } = await signup(handle, email);
    await handle.get<UserService>(UserService).updateUser(userId, { mustChangePassword: true });

    const li = await login(handle, email, PW);
    expect(li.body.mustChangePassword).toBe(true); // surfaced
    const ping = await request(handle.httpServer).get('/app/ping').set('Authorization', `Bearer ${tokenOf(li.body)}`);
    expect(ping.status).toBe(200); // NOT blocked
  });
});

/**
 * GET /auth/mfa/status must report `allowUserToggle` / `canToggle` from POLICY
 * (config), not from whether the user already has MFA on. Otherwise a user with
 * MFA off gets canToggle=false and self-service can never be switched on — even
 * though the toggle endpoint (canUserToggleMfa) would accept it.
 *
 * NO MOCKS — real NestJS + real DB + real HTTP.
 */
import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

const PW = 'StrongPass!1word';

async function boot(mfa: Record<string, unknown>): Promise<TestAppHandle> {
  return bootTestApp({ nestAuth: { appName: 'MFA Status', mfa: { methods: ['totp', 'email'], ...mfa } } as any });
}
async function signup(handle: TestAppHandle, email: string): Promise<string> {
  const res = await request(handle.httpServer).post('/auth/signup').send({ email, password: PW });
  expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);
  return res.body.accessToken ?? res.body.tokens?.accessToken;
}
async function status(handle: TestAppHandle, token: string) {
  const res = await request(handle.httpServer).get('/auth/mfa/status').set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  return res.body;
}

let handle: TestAppHandle;
afterEach(async () => { await handle?.close(); });

describe('GET /auth/mfa/status — allowUserToggle reflects policy, not user state', () => {
  it('a user with MFA OFF can still toggle when allowUserToggle=true, required=false', async () => {
    handle = await boot({ enabled: true, required: false, allowUserToggle: true });
    const token = await signup(handle, 'toggle-on@test.local');
    const body = await status(handle, token);

    expect(body.isEnabled).toBe(false);       // user hasn't enabled it yet
    expect(body.allowUserToggle).toBe(true);  // ← the fix (was false)
    expect(body.canToggle).toBe(true);        // ← the fix (was false)
    expect(body.required).toBe(false);
  });

  it('canToggle is false when MFA is required (can\'t opt out)', async () => {
    handle = await boot({ enabled: true, required: true, allowUserToggle: true });
    const token = await signup(handle, 'required@test.local');
    const body = await status(handle, token);
    expect(body.required).toBe(true);
    expect(body.canToggle).toBe(false);
  });

  it('canToggle is false when the policy forbids self-service', async () => {
    handle = await boot({ enabled: true, required: false, allowUserToggle: false });
    const token = await signup(handle, 'no-toggle@test.local');
    const body = await status(handle, token);
    expect(body.allowUserToggle).toBe(false);
    expect(body.canToggle).toBe(false);
  });
});

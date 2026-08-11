/**
 * A consumer's `mfa.methods` REPLACES the default `[EMAIL, TOTP]` — it must not
 * be concatenated with it. The library deep-merges config twice
 * (`NestAuthModule.getOptions` then `AuthConfigService.setOptions`), and deepmerge
 * concatenates arrays, so before this fix an app that set `methods: ['totp']`
 * still got EMAIL merged back in and could never restrict MFA to a subset.
 *
 * NO MOCKS — real NestJS + real DB + real `speakeasy` TOTP.
 */
import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import speakeasy from 'speakeasy';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

const PW = 'MfaPassword!1';
const totpFor = (s: string) => speakeasy.totp({ secret: s, encoding: 'base32' });
const tokenOf = (b: any): string => b?.accessToken ?? b?.tokens?.accessToken;

let handle: TestAppHandle;
afterEach(async () => { await handle?.close(); });

async function signup(email: string) {
  const r = await request(handle.httpServer).post('/auth/signup').send({ email, password: PW });
  expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
  return tokenOf(r.body);
}
async function enableTotp(fullToken: string) {
  const setup = await request(handle.httpServer).post('/auth/mfa/setup-totp').set('Authorization', `Bearer ${fullToken}`).send({});
  const secret = setup.body.secret;
  await request(handle.httpServer).post('/auth/mfa/verify-totp-setup').set('Authorization', `Bearer ${fullToken}`).send({ secret, otp: totpFor(secret) });
  const t = await request(handle.httpServer).post('/auth/mfa/toggle').set('Authorization', `Bearer ${fullToken}`).send({ enabled: true });
  expect(t.status, JSON.stringify(t.body)).toBe(200);
  return secret;
}
async function loginMfa(email: string) {
  const l = await request(handle.httpServer).post('/auth/login').send({ providerName: 'email', credentials: { email, password: PW } });
  expect(l.body.isRequiresMfa, JSON.stringify(l.body)).toBe(true);
  return l.body;
}

describe('mfa.methods replaces the default — an app can restrict the method set', () => {
  it('methods: ["totp"] yields TOTP-only — EMAIL is NOT merged back in', async () => {
    handle = await bootTestApp({ nestAuth: { mfa: { enabled: true, allowUserToggle: true, methods: ['totp'] } } as any });
    const email = 'restrict-totp@test.local';
    await enableTotp(await signup(email));
    const body = await loginMfa(email);
    expect(body.mfaMethods).toEqual(['totp']); // ← the fix (was ['email','totp'])
    expect(body.defaultMfaMethod).toBe('totp');
  });

  it('methods: ["email"] yields EMAIL-only — TOTP is not offered', async () => {
    handle = await bootTestApp({ nestAuth: { mfa: { enabled: true, allowUserToggle: true, methods: ['email'] } } as any });
    const email = 'restrict-email@test.local';
    const full = await signup(email);
    const t = await request(handle.httpServer).post('/auth/mfa/toggle').set('Authorization', `Bearer ${full}`).send({ enabled: true });
    expect(t.status, JSON.stringify(t.body)).toBe(200);
    const body = await loginMfa(email);
    expect(body.mfaMethods).toEqual(['email']);
  });

  it('no override keeps the default (email present)', async () => {
    handle = await bootTestApp({ nestAuth: { mfa: { enabled: true, allowUserToggle: true } } as any });
    const email = 'default-methods@test.local';
    const full = await signup(email);
    const t = await request(handle.httpServer).post('/auth/mfa/toggle').set('Authorization', `Bearer ${full}`).send({ enabled: true });
    expect(t.status).toBe(200);
    const body = await loginMfa(email);
    expect(body.mfaMethods).toContain('email'); // default [email, totp] retained
  });
});

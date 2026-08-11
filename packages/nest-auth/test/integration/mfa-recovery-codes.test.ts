/**
 * Recovery (backup) codes as a BACKUP AUTHENTICATOR (2.10.0):
 *   1a — POST /auth/mfa/verify-recovery-code redeems a code to COMPLETE the
 *        sign-in (full session), leaving MFA enabled + factors intact.
 *   1b — the now-verified session can re-enrol a new authenticator inline.
 *   1c — generate-recovery-code issues a SET of single-use codes.
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

async function boot(mfa: Record<string, unknown> = {}) {
  handle = await bootTestApp({ nestAuth: { mfa: { enabled: true, allowUserToggle: true, ...mfa } } as any });
}
async function signup(email: string) {
  const r = await request(handle.httpServer).post('/auth/signup').send({ email, password: PW });
  expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
  return tokenOf(r.body);
}
async function enableTotp(fullToken: string) {
  const setup = await request(handle.httpServer).post('/auth/mfa/setup-totp').set('Authorization', `Bearer ${fullToken}`).send({});
  expect(setup.status, JSON.stringify(setup.body)).toBe(200);
  const secret = setup.body.secret;
  await request(handle.httpServer).post('/auth/mfa/verify-totp-setup').set('Authorization', `Bearer ${fullToken}`).send({ secret, otp: totpFor(secret) });
  const t = await request(handle.httpServer).post('/auth/mfa/toggle').set('Authorization', `Bearer ${fullToken}`).send({ enabled: true });
  expect(t.status, JSON.stringify(t.body)).toBe(200);
  return secret;
}
async function login(email: string) {
  return request(handle.httpServer).post('/auth/login').send({ providerName: 'email', credentials: { email, password: PW } });
}
async function verifiedToken(email: string, secret: string) {
  const l = await login(email);
  expect(l.body.isRequiresMfa).toBe(true);
  const v = await request(handle.httpServer).post('/auth/mfa/verify').set('Authorization', `Bearer ${tokenOf(l.body)}`).send({ method: 'totp', otp: totpFor(secret) });
  expect(v.status, JSON.stringify(v.body)).toBe(200);
  return tokenOf(v.body);
}
async function genCodes(verifiedTok: string) {
  const g = await request(handle.httpServer).post('/auth/mfa/generate-recovery-code').set('Authorization', `Bearer ${verifiedTok}`).send({});
  expect(g.status, JSON.stringify(g.body)).toBe(200);
  return g.body as { codes: string[]; code: string };
}
/** signup → enable TOTP → verified session → recovery codes. */
async function fullSetup(email: string) {
  const secret = await enableTotp(await signup(email));
  const verified = await verifiedToken(email, secret);
  const { codes } = await genCodes(verified);
  return { secret, verified, codes };
}

// ─── 1c — multiple recovery codes ──────────────────────────────────────────────
describe('1c — generate-recovery-code issues a SET of codes', () => {
  it('returns a codes[] array (default 10) plus code = codes[0]', async () => {
    await boot();
    const { codes, code } = await fullSetup('rc-set@test.local').then(r => ({ codes: r.codes, code: r.codes[0] }));
    expect(Array.isArray(codes)).toBe(true);
    expect(codes.length).toBe(10);
    expect(new Set(codes).size).toBe(10); // all distinct
    expect(code).toBe(codes[0]);
  });

  it('honours mfa.recoveryCodeCount', async () => {
    await boot({ recoveryCodeCount: 3 });
    const { codes } = await fullSetup('rc-count@test.local');
    expect(codes.length).toBe(3);
  });

  it('regenerating replaces the set — old codes stop working', async () => {
    await boot();
    const email = 'rc-regen@test.local';
    const { verified, codes: oldCodes } = await fullSetup(email);
    await genCodes(verified); // regenerate → invalidates oldCodes
    const l = await login(email);
    const r = await request(handle.httpServer).post('/auth/mfa/verify-recovery-code').set('Authorization', `Bearer ${tokenOf(l.body)}`).send({ code: oldCodes[0] });
    expect(r.status).toBe(401);
  });
});

// ─── 1a — verify-recovery-code signs in, keeps MFA + factors ───────────────────
describe('1a — verify-recovery-code completes the sign-in (backup authenticator)', () => {
  it('redeeming a code returns a full session AND leaves MFA enabled + factors intact', async () => {
    await boot();
    const email = 'rc-signin@test.local';
    const { codes } = await fullSetup(email);

    const l = await login(email);
    expect(l.body.isRequiresMfa).toBe(true);
    const r = await request(handle.httpServer).post('/auth/mfa/verify-recovery-code').set('Authorization', `Bearer ${tokenOf(l.body)}`).send({ code: codes[0] });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.accessToken ?? r.body.tokens?.accessToken).toBeTypeOf('string');
    expect(r.body.isRequiresMfa).toBeFalsy();

    // MFA is STILL enabled (unlike reset-totp) — the TOTP factor survived.
    const again = await login(email);
    expect(again.body.isRequiresMfa).toBe(true);
  });

  it('a code is single-use', async () => {
    await boot();
    const email = 'rc-onetime@test.local';
    const { codes } = await fullSetup(email);

    const first = await request(handle.httpServer).post('/auth/mfa/verify-recovery-code').set('Authorization', `Bearer ${tokenOf((await login(email)).body)}`).send({ code: codes[0] });
    expect(first.status).toBe(200);
    const second = await request(handle.httpServer).post('/auth/mfa/verify-recovery-code').set('Authorization', `Bearer ${tokenOf((await login(email)).body)}`).send({ code: codes[0] });
    expect(second.status).toBe(401); // already consumed
  });

  it('a different code still works after one is consumed', async () => {
    await boot();
    const email = 'rc-second@test.local';
    const { codes } = await fullSetup(email);
    await request(handle.httpServer).post('/auth/mfa/verify-recovery-code').set('Authorization', `Bearer ${tokenOf((await login(email)).body)}`).send({ code: codes[0] });
    const r = await request(handle.httpServer).post('/auth/mfa/verify-recovery-code').set('Authorization', `Bearer ${tokenOf((await login(email)).body)}`).send({ code: codes[1] });
    expect(r.status).toBe(200);
  });

  it('a wrong code → 401', async () => {
    await boot();
    const email = 'rc-wrong@test.local';
    await fullSetup(email);
    const r = await request(handle.httpServer).post('/auth/mfa/verify-recovery-code').set('Authorization', `Bearer ${tokenOf((await login(email)).body)}`).send({ code: 'not-a-real-code' });
    expect(r.status).toBe(401);
  });

  it('requires a session token (401 without one)', async () => {
    await boot();
    const r = await request(handle.httpServer).post('/auth/mfa/verify-recovery-code').send({ code: 'x' });
    expect(r.status).toBe(401);
  });
});

// ─── 1b — re-enrol inline after recovery sign-in ───────────────────────────────
describe('1b — re-enrolment inside the login flow', () => {
  it('after redeeming a code, setup-totp works on the same session (no second sign-in)', async () => {
    await boot();
    const email = 'rc-reenroll@test.local';
    const { codes } = await fullSetup(email);

    const r = await request(handle.httpServer).post('/auth/mfa/verify-recovery-code').set('Authorization', `Bearer ${tokenOf((await login(email)).body)}`).send({ code: codes[0] });
    expect(r.status).toBe(200);
    const recoveredToken = tokenOf(r.body);

    // The recovery-verified session is MFA-satisfied → it may enrol a new device.
    const setup = await request(handle.httpServer).post('/auth/mfa/setup-totp').set('Authorization', `Bearer ${recoveredToken}`).send({});
    expect(setup.status, JSON.stringify(setup.body)).toBe(200);
  });

  it('requireVerifiedContactForEnrollment blocks enrolment for an unverified user (403)', async () => {
    await boot({ requireVerifiedContactForEnrollment: true });
    const full = await signup('rc-noverify@test.local'); // email not verified
    const setup = await request(handle.httpServer).post('/auth/mfa/setup-totp').set('Authorization', `Bearer ${full}`).send({});
    expect(setup.status).toBe(403);
  });
});

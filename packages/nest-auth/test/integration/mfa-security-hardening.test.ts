/**
 * MFA hardening — three fixes that harden the recovery/challenge flow.
 *
 * 1. SECURITY: a challenge-stage token (login issues `isMfaEnabled && !isMfaVerified`
 *    before the second factor) must NOT be able to CHANGE MFA config — otherwise
 *    a password-only attacker can enrol their own authenticator and satisfy the
 *    challenge with it. The config-changing routes are no longer `@SkipMfa`.
 * 2. `reset-totp` (recovery code) must not leave "MFA on, zero methods" — that
 *    permanently locks out a TOTP-only user.
 * 3. `defaultMfaMethod` in the login response must be one the user actually has.
 *
 * NO MOCKS — real NestJS + real DB + real `speakeasy` TOTP codes.
 */
import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import speakeasy from 'speakeasy';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

const PW = 'MfaPassword!1';
const totpFor = (secret: string) => speakeasy.totp({ secret, encoding: 'base32' });
const tokenOf = (b: any): string => b?.accessToken ?? b?.tokens?.accessToken;

let handle: TestAppHandle;
afterEach(async () => { await handle?.close(); });

async function boot(mfa: Record<string, unknown>) {
  handle = await bootTestApp({ nestAuth: { mfa: { enabled: true, allowUserToggle: true, ...mfa } } as any });
}
async function signup(email: string): Promise<string> {
  const r = await request(handle.httpServer).post('/auth/signup').send({ email, password: PW });
  expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
  return tokenOf(r.body);
}
/** Set up + verify a TOTP device and toggle MFA on, using a fully-authed token. Returns the secret. */
async function enableTotp(fullToken: string): Promise<string> {
  const setup = await request(handle.httpServer).post('/auth/mfa/setup-totp').set('Authorization', `Bearer ${fullToken}`).send({});
  expect(setup.status, JSON.stringify(setup.body)).toBe(200);
  const secret = setup.body.secret;
  const v = await request(handle.httpServer).post('/auth/mfa/verify-totp-setup').set('Authorization', `Bearer ${fullToken}`).send({ secret, otp: totpFor(secret) });
  expect(v.status, JSON.stringify(v.body)).toBe(200);
  const t = await request(handle.httpServer).post('/auth/mfa/toggle').set('Authorization', `Bearer ${fullToken}`).send({ enabled: true });
  expect(t.status, JSON.stringify(t.body)).toBe(200);
  return secret;
}
async function login(email: string) {
  return request(handle.httpServer).post('/auth/login').send({ providerName: 'email', credentials: { email, password: PW } });
}
/** Complete the MFA challenge and return a fully MFA-verified token. */
async function verifiedToken(email: string, secret: string): Promise<string> {
  const l = await login(email);
  expect(l.body.isRequiresMfa).toBe(true);
  const v = await request(handle.httpServer).post('/auth/mfa/verify')
    .set('Authorization', `Bearer ${tokenOf(l.body)}`)
    .send({ method: 'totp', otp: totpFor(secret) });
  expect(v.status, JSON.stringify(v.body)).toBe(200);
  return tokenOf(v.body);
}

// ─── Item 1 — challenge-stage token cannot change MFA config ───────────────────
describe('MFA item 1 — a challenge-stage token cannot change MFA config', () => {
  it('blocks setup-totp / verify-totp-setup / generate-recovery-code / toggle / remove-device (401)', async () => {
    await boot({ methods: ['totp'] });
    const email = 'bypass@test.local';
    await enableTotp(await signup(email));

    const l = await login(email);
    expect(l.body.isRequiresMfa).toBe(true);
    const challenge = tokenOf(l.body); // isMfaEnabled && !isMfaVerified
    const bearer = `Bearer ${challenge}`;
    const srv = handle.httpServer;

    expect((await request(srv).post('/auth/mfa/setup-totp').set('Authorization', bearer).send({})).status).toBe(401);
    expect((await request(srv).post('/auth/mfa/verify-totp-setup').set('Authorization', bearer).send({ secret: 'x', otp: '000000' })).status).toBe(401);
    expect((await request(srv).post('/auth/mfa/generate-recovery-code').set('Authorization', bearer).send({})).status).toBe(401);
    expect((await request(srv).post('/auth/mfa/toggle').set('Authorization', bearer).send({ enabled: false })).status).toBe(401);
    expect((await request(srv).delete('/auth/mfa/devices/any-id').set('Authorization', bearer)).status).toBe(401);
  });

  it('the full password-only bypass chain is closed (setup with challenge token → 401)', async () => {
    await boot({ methods: ['totp'] });
    const email = 'attacker-victim@test.local';
    await enableTotp(await signup(email));

    // Attacker has only the password → gets a challenge token, tries to enrol their own device.
    const l = await login(email);
    const attack = await request(handle.httpServer).post('/auth/mfa/setup-totp').set('Authorization', `Bearer ${tokenOf(l.body)}`).send({});
    expect(attack.status).toBe(401);
    expect(JSON.stringify(attack.body)).toContain('MFA'); // MFA_REQUIRED
  });

  it('a FULLY MFA-verified token CAN still manage MFA (setup-totp → 200)', async () => {
    await boot({ methods: ['totp'] });
    const email = 'legit@test.local';
    const secret = await enableTotp(await signup(email));
    const verified = await verifiedToken(email, secret);
    const setup = await request(handle.httpServer).post('/auth/mfa/setup-totp').set('Authorization', `Bearer ${verified}`).send({});
    expect(setup.status).toBe(200);
  });

  it('first-time enrolment is unaffected — setup-totp with the signup token (MFA off) → 200', async () => {
    await boot({ methods: ['totp'] });
    const full = await signup('first-timer@test.local');
    const setup = await request(handle.httpServer).post('/auth/mfa/setup-totp').set('Authorization', `Bearer ${full}`).send({});
    expect(setup.status).toBe(200);
  });
});

// ─── Item 2 — reset must not leave "MFA on, zero methods" ──────────────────────
describe('MFA item 2 — reset-totp must not lock a TOTP-only user out', () => {
  it('no recoverable contact: a recovery reset disables MFA (no "on, zero methods" lockout)', async () => {
    // The library always keeps EMAIL in the effective methods (it concatenates
    // with the default [EMAIL, TOTP]), so an email-having user always retains an
    // EMAIL method and is never locked out. The lockout the fix guards against is
    // a user with NO recoverable contact (no email/phone) and TOTP only — we
    // reproduce that by clearing the email after enrolment.
    await boot({ methods: ['totp'] });
    const email = 'reset-lockout@test.local';
    const secret = await enableTotp(await signup(email));
    const verified = await verifiedToken(email, secret);

    const gen = await request(handle.httpServer).post('/auth/mfa/generate-recovery-code').set('Authorization', `Bearer ${verified}`).send({});
    expect(gen.status).toBe(200);
    const recoveryCode = gen.body.code;

    const ds = handle.get(require('typeorm').DataSource);
    const [{ id: userId }] = await ds.query(`SELECT id FROM nest_auth_users WHERE email = 'reset-lockout@test.local'`);
    await ds.query(`UPDATE nest_auth_users SET email = NULL WHERE id = '${userId}'`); // no recoverable contact

    const reset = await request(handle.httpServer).post('/auth/mfa/reset-totp').set('Authorization', `Bearer ${verified}`).send({ code: recoveryCode });
    expect(reset.status, JSON.stringify(reset.body)).toBe(200);

    // THE FIX: zero methods remained → MFA is turned OFF (not left "on, zero
    // methods" which would permanently lock the user out), and the recovery code
    // is consumed.
    const [row] = await ds.query(`SELECT "isMfaEnabled", "mfaRecoveryCode" FROM nest_auth_users WHERE id = '${userId}'`);
    expect(Boolean(row.isMfaEnabled)).toBe(false);
    expect(row.mfaRecoveryCode == null).toBe(true);
  });

  it('a surviving EMAIL method keeps MFA ON after reset (only disables when truly locked out)', async () => {
    await boot({ methods: ['totp', 'email'] });
    const email = 'reset-keeps-email@test.local';
    const secret = await enableTotp(await signup(email));
    const verified = await verifiedToken(email, secret);

    const gen = await request(handle.httpServer).post('/auth/mfa/generate-recovery-code').set('Authorization', `Bearer ${verified}`).send({});
    const recoveryCode = gen.body.code;

    const l = await login(email);
    const reset = await request(handle.httpServer).post('/auth/mfa/reset-totp').set('Authorization', `Bearer ${tokenOf(l.body)}`).send({ code: recoveryCode });
    expect(reset.status).toBe(200);

    // EMAIL is still an available method → MFA stays ON; the user is not locked out.
    const relogin = await login(email);
    expect(relogin.body.isRequiresMfa).toBe(true);
    expect(relogin.body.mfaMethods).toContain('email');
    expect(relogin.body.mfaMethods).not.toContain('totp'); // TOTP was reset away
  });
});

// ─── Item 3 — defaultMfaMethod reflects the user's methods ─────────────────────
describe('MFA item 3 — defaultMfaMethod must be a method the user actually has', () => {
  it('user with only EMAIL gets defaultMfaMethod=email even when the app default is totp', async () => {
    await boot({ methods: ['email', 'totp'], defaultMethod: 'totp' });
    const email = 'default-email@test.local';
    const full = await signup(email);

    // Enable MFA with EMAIL only — no TOTP device enrolled.
    const toggle = await request(handle.httpServer).post('/auth/mfa/toggle').set('Authorization', `Bearer ${full}`).send({ enabled: true });
    expect(toggle.status, JSON.stringify(toggle.body)).toBe(200);

    const l = await login(email);
    expect(l.body.isRequiresMfa).toBe(true);
    expect(l.body.mfaMethods).toContain('email');
    expect(l.body.mfaMethods).not.toContain('totp'); // no device → not offered
    expect(l.body.defaultMfaMethod, JSON.stringify(l.body)).toBe('email'); // ← the fix (was 'totp')
  });

  it('the app default IS honoured when the user has it (totp)', async () => {
    await boot({ methods: ['email', 'totp'], defaultMethod: 'totp' });
    const email = 'default-totp@test.local';
    await enableTotp(await signup(email));

    const l = await login(email);
    expect(l.body.isRequiresMfa).toBe(true);
    expect(l.body.defaultMfaMethod).toBe('totp');
  });
});

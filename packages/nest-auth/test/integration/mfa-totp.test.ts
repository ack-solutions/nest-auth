/**
 * Real integration tests for the TOTP MFA setup + enforcement flow.
 *
 * NO MOCKS. Real NestJS + real DB + real `speakeasy` TOTP generation (the same
 * library the server uses to verify) — we generate genuine time-based codes.
 *
 * Covers: TC-090 (setup returns secret), TC-091 (verify enables), TC-092 (wrong
 * code rejected), TC-094 (login requires MFA after enable).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import speakeasy from 'speakeasy';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

function token(body: any): string {
  const t = body?.accessToken ?? body?.tokens?.accessToken;
  if (!t) throw new Error(`no token: ${JSON.stringify(body)}`);
  return t;
}

/** Generate a valid TOTP code for a base32 secret, exactly as a real authenticator app would. */
function totpFor(secretBase32: string): string {
  return speakeasy.totp({ secret: secretBase32, encoding: 'base32' });
}

describe('TOTP MFA setup + enforcement — TC-090..TC-094', () => {
  let handle: TestAppHandle;

  beforeEach(async () => {
    handle = await bootTestApp({
      nestAuth: {
        // Enable MFA in the module config, and allow users to toggle it on/off
        mfa: { enabled: true, methods: ['totp'], allowUserToggle: true } as any,
      },
    });
  });

  afterEach(async () => {
    await handle.close();
  });

  async function signup(email: string): Promise<string> {
    const res = await request(handle.httpServer)
      .post('/auth/signup')
      .send({ email, password: 'MfaPassword!1' });
    expect(res.status, `signup failed: ${JSON.stringify(res.body)}`).toBeLessThan(300);
    return token(res.body);
  }

  it('TC-090: setup-totp returns a base32 secret + QR code', async () => {
    const accessToken = await signup('mfa-setup@test.local');

    const res = await request(handle.httpServer)
      .post('/auth/mfa/setup-totp')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    if (res.status >= 400) {
      // eslint-disable-next-line no-console
      console.error('[setup-totp failure]', res.status, JSON.stringify(res.body, null, 2));
    }
    expect(res.status).toBe(200);
    expect(res.body.secret).toBeTypeOf('string');
    expect(res.body.secret.length).toBeGreaterThan(10);
    expect(res.body.qrCode).toBeTypeOf('string'); // data-uri QR
  });

  it('TC-091: verify-totp-setup with a valid code succeeds', async () => {
    const accessToken = await signup('mfa-verify@test.local');

    const setup = await request(handle.httpServer)
      .post('/auth/mfa/setup-totp')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(setup.status).toBe(200);

    const secret = setup.body.secret;
    const otp = totpFor(secret);

    const verify = await request(handle.httpServer)
      .post('/auth/mfa/verify-totp-setup')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ secret, otp });

    if (verify.status >= 400) {
      // eslint-disable-next-line no-console
      console.error('[verify-totp-setup failure]', verify.status, JSON.stringify(verify.body, null, 2));
    }
    expect(verify.status).toBe(200);
  });

  it('TC-092: verify-totp-setup with a WRONG code → 401', async () => {
    const accessToken = await signup('mfa-wrong@test.local');

    const setup = await request(handle.httpServer)
      .post('/auth/mfa/setup-totp')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(setup.status).toBe(200);

    const verify = await request(handle.httpServer)
      .post('/auth/mfa/verify-totp-setup')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ secret: setup.body.secret, otp: '000000' });

    expect(verify.status).toBe(401);
  });

  it('setup-totp requires auth → 401 without token', async () => {
    const res = await request(handle.httpServer).post('/auth/mfa/setup-totp').send({});
    expect(res.status).toBe(401);
  });

  it('TC-094: after enabling TOTP, a fresh login requires MFA', async () => {
    const email = 'mfa-login@test.local';
    const accessToken = await signup(email);

    // Enable TOTP
    const setup = await request(handle.httpServer)
      .post('/auth/mfa/setup-totp')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    const secret = setup.body.secret;
    const verify = await request(handle.httpServer)
      .post('/auth/mfa/verify-totp-setup')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ secret, otp: totpFor(secret) });
    expect(verify.status).toBe(200);

    // Verifying a device does NOT auto-enable MFA — that's a deliberate separate
    // step. Toggle it on now (requires at least one verified method, which we have).
    const toggle = await request(handle.httpServer)
      .post('/auth/mfa/toggle')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ enabled: true });
    if (toggle.status >= 400) {
      // eslint-disable-next-line no-console
      console.error('[mfa toggle failure]', toggle.status, JSON.stringify(toggle.body, null, 2));
    }
    expect(toggle.status).toBe(200);

    // Fresh login should now indicate MFA is required (no full tokens yet)
    const login = await request(handle.httpServer)
      .post('/auth/login')
      .send({ providerName: 'email', credentials: { email, password: 'MfaPassword!1' } });

    expect(login.status).toBeLessThan(300);
    // The response should flag MFA requirement. Exact shape: isRequiresMfa=true.
    expect(login.body.isRequiresMfa, `expected isRequiresMfa=true, got: ${JSON.stringify(login.body)}`).toBe(true);
  });
});

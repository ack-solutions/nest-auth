/**
 * Real integration test for the FULL MFA login challenge flow:
 *   enable TOTP → login (mfaRequired + pending token) → submit TOTP → full tokens.
 *
 * NO MOCKS. Real speakeasy TOTP generation, real DB, real JWT.
 *
 * Covers: TC-094 (login requires MFA), TC-095 (challenge with valid TOTP → tokens),
 *         TC-096 (wrong TOTP → 401).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import speakeasy from 'speakeasy';
import { NestAuthMFAMethodEnum } from '@ackplus/nest-auth-contracts';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

const PASSWORD = 'MfaChallenge!1';

function totpFor(secret: string): string {
  return speakeasy.totp({ secret, encoding: 'base32' });
}

describe('Full MFA login challenge — TC-094..TC-096', () => {
  let handle: TestAppHandle;

  beforeEach(async () => {
    handle = await bootTestApp({
      nestAuth: {
        mfa: { enabled: true, methods: ['totp'], allowUserToggle: true } as any,
      },
    });
  });

  afterEach(async () => {
    await handle.close();
  });

  /** Signs up, enables TOTP, returns { email, secret }. */
  async function enrollTotp(email: string): Promise<{ secret: string }> {
    const signup = await request(handle.httpServer)
      .post('/auth/signup')
      .send({ email, password: PASSWORD });
    const token = signup.body.accessToken ?? signup.body.tokens?.accessToken;

    const setup = await request(handle.httpServer)
      .post('/auth/mfa/setup-totp')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    const secret = setup.body.secret;

    await request(handle.httpServer)
      .post('/auth/mfa/verify-totp-setup')
      .set('Authorization', `Bearer ${token}`)
      .send({ secret, otp: totpFor(secret) });

    await request(handle.httpServer)
      .post('/auth/mfa/toggle')
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: true });

    return { secret };
  }

  it('TC-095: login → mfaRequired → submit TOTP → full tokens', async () => {
    const email = 'mfa-challenge@test.local';
    const { secret } = await enrollTotp(email);

    // Login → pending token + isRequiresMfa
    const login = await request(handle.httpServer)
      .post('/auth/login')
      .send({ providerName: 'email', credentials: { email, password: PASSWORD } });
    expect(login.status).toBeLessThan(300);
    expect(login.body.isRequiresMfa).toBe(true);
    const pendingToken = login.body.accessToken ?? login.body.tokens?.accessToken;
    expect(pendingToken, 'login should return a pending token to submit MFA with').toBeTypeOf('string');

    // Submit the TOTP code via mfa/verify
    const verify = await request(handle.httpServer)
      .post('/auth/mfa/verify')
      .set('Authorization', `Bearer ${pendingToken}`)
      .send({ method: NestAuthMFAMethodEnum.TOTP, otp: totpFor(secret) });

    if (verify.status >= 400) {
      // eslint-disable-next-line no-console
      console.error('[mfa verify failure]', verify.status, JSON.stringify(verify.body, null, 2));
    }
    expect(verify.status).toBeLessThan(300);

    // The verified response should carry tokens and NOT require MFA anymore
    const finalToken = verify.body.accessToken ?? verify.body.tokens?.accessToken;
    expect(finalToken).toBeTypeOf('string');
    expect(verify.body.isRequiresMfa).toBeFalsy();
  });

  it('TC-096: wrong TOTP code at challenge → 401', async () => {
    const email = 'mfa-challenge-wrong@test.local';
    await enrollTotp(email);

    const login = await request(handle.httpServer)
      .post('/auth/login')
      .send({ providerName: 'email', credentials: { email, password: PASSWORD } });
    const pendingToken = login.body.accessToken ?? login.body.tokens?.accessToken;

    const verify = await request(handle.httpServer)
      .post('/auth/mfa/verify')
      .set('Authorization', `Bearer ${pendingToken}`)
      .send({ method: NestAuthMFAMethodEnum.TOTP, otp: '000000' });

    expect(verify.status).toBe(401);
  });

  it('mfa/verify requires the pending auth token → 401 without it', async () => {
    const verify = await request(handle.httpServer)
      .post('/auth/mfa/verify')
      .send({ method: NestAuthMFAMethodEnum.TOTP, otp: '123456' });
    expect(verify.status).toBe(401);
  });
});

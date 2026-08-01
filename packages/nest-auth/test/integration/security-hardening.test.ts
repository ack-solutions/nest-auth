/**
 * Regression tests for the P0 auth-hardening fixes from the security audit.
 *
 * NO MOCKS. Real NestJS + real DB + real JWT/OTP/TOTP machinery. Each test
 * reproduces the concrete attack the fix closes:
 *   - jwt login provider is OPT-IN (was a full account-takeover primitive)      #1/#3
 *   - a refresh token cannot be used as a Bearer access token                    #9
 *   - OTP verification is attempt-capped (no brute force of a 6-digit code)      #2
 *   - a user cannot delete another user's TOTP device (IDOR)                     #16
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { attachEventCapture, type EventCapture } from '../helpers/event-capture';

// Must match boot-test-app's DEFAULT_NEST_AUTH_CONFIG secret.
const TEST_JWT_SECRET = 'test-secret-do-not-use-in-prod';

function extractTokens(body: any): { accessToken?: string; refreshToken?: string } {
  return {
    accessToken: body?.accessToken ?? body?.tokens?.accessToken,
    refreshToken: body?.refreshToken ?? body?.tokens?.refreshToken,
  };
}

describe("'jwt' login provider is opt-in (unauthenticated ATO closed by default)", () => {
  let handle: TestAppHandle;
  beforeEach(async () => { handle = await bootTestApp(); });
  afterEach(async () => { await handle.close(); });

  it('rejects login via providerName:jwt with a validly-signed forged token when not enabled', async () => {
    // A token an attacker could mint with a leaked/guessed secret, claiming any sub.
    const forged = jwt.sign({ sub: 'victim-user-id', email: 'victim@test.local' }, TEST_JWT_SECRET);

    const res = await request(handle.httpServer)
      .post('/auth/login')
      .send({ providerName: 'jwt', credentials: { token: forged } });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(extractTokens(res.body).accessToken).toBeUndefined();
  });
});

describe("'jwt' login provider, when enabled, refuses session tokens (defense in depth)", () => {
  let handle: TestAppHandle;
  beforeEach(async () => {
    handle = await bootTestApp({
      nestAuth: { session: { jwt: { secret: TEST_JWT_SECRET, enableLoginProvider: true } } } as any,
    });
  });
  afterEach(async () => { await handle.close(); });

  it('rejects an internally-shaped access token replayed to the jwt provider', async () => {
    const sessionToken = jwt.sign({ sub: 'victim-user-id', type: 'access' }, TEST_JWT_SECRET);

    const res = await request(handle.httpServer)
      .post('/auth/login')
      .send({ providerName: 'jwt', credentials: { token: sessionToken } });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(extractTokens(res.body).accessToken).toBeUndefined();
  });
});

describe('token type is enforced (a refresh token is not a valid access token)', () => {
  let handle: TestAppHandle;
  beforeEach(async () => { handle = await bootTestApp(); });
  afterEach(async () => { await handle.close(); });

  it('accepts the access token but rejects the refresh token as Bearer on a protected route', async () => {
    const email = 'token-type@test.local';
    await request(handle.httpServer).post('/auth/signup').send({ email, password: 'TokenType!1' });

    const login = await request(handle.httpServer)
      .post('/auth/login')
      .send({ providerName: 'email', credentials: { email, password: 'TokenType!1' } });
    expect(login.status).toBeLessThan(300);

    const { accessToken, refreshToken } = extractTokens(login.body);
    expect(accessToken, 'need an access token').toBeTypeOf('string');
    expect(refreshToken, 'need a refresh token (header mode)').toBeTypeOf('string');

    // Control: the access token works.
    const ok = await request(handle.httpServer).get('/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(ok.status).toBe(200);

    // The refresh token must NOT authenticate a normal request.
    const bad = await request(handle.httpServer).get('/auth/me').set('Authorization', `Bearer ${refreshToken}`);
    expect(bad.status).toBe(401);
  });
});

describe('OTP verification is attempt-capped (reset code cannot be brute-forced)', () => {
  let handle: TestAppHandle;
  let events: EventCapture;
  beforeEach(async () => { handle = await bootTestApp(); events = attachEventCapture(handle); });
  afterEach(async () => { await handle.close(); });

  it('invalidates the reset code after maxAttempts wrong guesses', async () => {
    const email = 'otp-cap@test.local';
    await request(handle.httpServer).post('/auth/signup').send({ email, password: 'OtpCap!1' });

    await request(handle.httpServer).post('/auth/forgot-password').send({ email });
    const code = events.lastPasswordResetCode();
    expect(code, 'need a captured reset code').toBeTypeOf('string');

    const wrong = code === '000000' ? '111111' : '000000';

    // Exhaust the 5-attempt cap with wrong guesses.
    for (let i = 0; i < 5; i++) {
      const r = await request(handle.httpServer)
        .post('/auth/verify-forgot-password-otp')
        .send({ email, code: wrong });
      expect(r.status).toBeGreaterThanOrEqual(400);
    }

    // The (previously valid) correct code is now rejected — the code was invalidated.
    const afterCap = await request(handle.httpServer)
      .post('/auth/verify-forgot-password-otp')
      .send({ email, code });
    expect(afterCap.status).toBeGreaterThanOrEqual(400);
    expect(afterCap.body.resetToken ?? afterCap.body.token).toBeUndefined();
  });
});

describe('TOTP device deletion is scoped to the owner (IDOR closed)', () => {
  let handle: TestAppHandle;
  beforeEach(async () => {
    handle = await bootTestApp({
      nestAuth: { mfa: { enabled: true, methods: ['totp'], allowUserToggle: true } } as any,
    });
  });
  afterEach(async () => { await handle.close(); });

  async function signupToken(email: string): Promise<string> {
    const res = await request(handle.httpServer).post('/auth/signup').send({ email, password: 'IdorTest!1' });
    expect(res.status).toBeLessThan(300);
    const t = extractTokens(res.body).accessToken;
    expect(t, `signup should return an access token: ${JSON.stringify(res.body)}`).toBeTypeOf('string');
    return t!;
  }

  it("returns 404 when a different user tries to delete someone else's device, and the device survives", async () => {
    // Victim A registers and verifies a TOTP device.
    const tokenA = await signupToken('idor-victim@test.local');
    const setup = await request(handle.httpServer)
      .post('/auth/mfa/setup-totp').set('Authorization', `Bearer ${tokenA}`).send({});
    expect(setup.status).toBe(200);
    const verify = await request(handle.httpServer)
      .post('/auth/mfa/verify-totp-setup').set('Authorization', `Bearer ${tokenA}`)
      .send({ secret: setup.body.secret, otp: speakeasy.totp({ secret: setup.body.secret, encoding: 'base32' }) });
    expect(verify.status).toBe(200);

    const devicesA = await request(handle.httpServer)
      .get('/auth/mfa/devices').set('Authorization', `Bearer ${tokenA}`);
    expect(devicesA.status).toBe(200);
    const deviceId = (Array.isArray(devicesA.body) ? devicesA.body : devicesA.body?.devices)?.[0]?.id;
    expect(deviceId, `expected a device id, got ${JSON.stringify(devicesA.body)}`).toBeTypeOf('string');

    // Attacker B tries to delete A's device.
    const tokenB = await signupToken('idor-attacker@test.local');
    const del = await request(handle.httpServer)
      .delete(`/auth/mfa/devices/${deviceId}`).set('Authorization', `Bearer ${tokenB}`);
    expect(del.status).toBe(404);

    // A's device is still there.
    const stillThere = await request(handle.httpServer)
      .get('/auth/mfa/devices').set('Authorization', `Bearer ${tokenA}`);
    const list = Array.isArray(stillThere.body) ? stillThere.body : stillThere.body?.devices;
    expect(list.some((d: any) => d.id === deviceId)).toBe(true);
  });
});

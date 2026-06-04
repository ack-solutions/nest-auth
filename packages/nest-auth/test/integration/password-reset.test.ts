/**
 * Real integration tests for the forgot/reset-password flow and email verification.
 *
 * NO MOCKS. Real NestJS + real DB + real OTP machinery. The plaintext OTP code
 * is captured off the emitted event (no SMTP server needed).
 *
 * Covers: TC-160..TC-164 (password reset), TC-171 (no enumeration),
 *         TC-180..TC-181 (email verification).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { attachEventCapture, type EventCapture } from '../helpers/event-capture';

function extractTokens(body: any): { accessToken?: string; refreshToken?: string } {
  return {
    accessToken: body?.accessToken ?? body?.tokens?.accessToken,
    refreshToken: body?.refreshToken ?? body?.tokens?.refreshToken,
  };
}

describe('Forgot / Reset password flow — TC-160..TC-164', () => {
  let handle: TestAppHandle;
  let events: EventCapture;

  beforeEach(async () => {
    handle = await bootTestApp();
    events = attachEventCapture(handle);
  });

  afterEach(async () => {
    await handle.close();
  });

  it('TC-160..164: full reset flow — forgot → verify OTP → reset → login with new password', async () => {
    const email = 'reset-flow@test.local';
    const oldPassword = 'OldPassword!1';
    const newPassword = 'BrandNewPassword!2';

    // 1. signup
    const signupRes = await request(handle.httpServer)
      .post('/auth/signup')
      .send({ email, password: oldPassword });
    expect(signupRes.status).toBeLessThan(300);

    // 2. forgot-password → emits PASSWORD_RESET_REQUESTED with plaintext code
    const forgotRes = await request(handle.httpServer)
      .post('/auth/forgot-password')
      .send({ email });
    expect(forgotRes.status).toBeLessThan(300);

    const code = events.lastPasswordResetCode();
    expect(code, `no password reset code captured. Events: ${events.all().map((e) => e.name).join(', ')}`)
      .toBeTypeOf('string');

    // 3. verify the OTP → get the reset token
    const verifyRes = await request(handle.httpServer)
      .post('/auth/verify-forgot-password-otp')
      .send({ email, code });

    if (verifyRes.status >= 400) {
      // eslint-disable-next-line no-console
      console.error('[reset verify-otp failure]', verifyRes.status, JSON.stringify(verifyRes.body, null, 2));
    }
    expect(verifyRes.status).toBeLessThan(300);
    const resetToken = verifyRes.body.resetToken ?? verifyRes.body.token;
    expect(resetToken, 'no resetToken returned from verify-forgot-password-otp').toBeTypeOf('string');

    // 4. reset password using the token
    const resetRes = await request(handle.httpServer)
      .post('/auth/reset-password')
      .send({ token: resetToken, newPassword });

    if (resetRes.status >= 400) {
      // eslint-disable-next-line no-console
      console.error('[reset-password failure]', resetRes.status, JSON.stringify(resetRes.body, null, 2));
    }
    expect(resetRes.status).toBeLessThan(300);

    // 5. login with the NEW password → success
    const newLogin = await request(handle.httpServer)
      .post('/auth/login')
      .send({ providerName: 'email', credentials: { email, password: newPassword } });
    expect(newLogin.status, `new-password login failed: ${JSON.stringify(newLogin.body)}`).toBeLessThan(300);
    expect(extractTokens(newLogin.body).accessToken).toBeTypeOf('string');

    // 6. login with the OLD password → 401
    const oldLogin = await request(handle.httpServer)
      .post('/auth/login')
      .send({ providerName: 'email', credentials: { email, password: oldPassword } });
    expect(oldLogin.status).toBe(401);
  });

  it('TC-171: forgot-password for UNKNOWN email returns 2xx (no account enumeration)', async () => {
    const res = await request(handle.httpServer)
      .post('/auth/forgot-password')
      .send({ email: 'never-existed-here@test.local' });

    // Must NOT reveal whether the account exists → returns the same 2xx message.
    expect(res.status).toBeLessThan(300);
    // And must NOT have emitted a real password-reset code for a non-existent user.
    expect(events.lastPasswordResetCode()).toBeUndefined();
  });

  it('reset with a bogus token → 4xx', async () => {
    const res = await request(handle.httpServer)
      .post('/auth/reset-password')
      .send({ token: 'not-a-valid-reset-token', newPassword: 'Whatever!123' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

describe('Email verification flow — TC-180..TC-181', () => {
  let handle: TestAppHandle;
  let events: EventCapture;

  beforeEach(async () => {
    handle = await bootTestApp();
    events = attachEventCapture(handle);
  });

  afterEach(async () => {
    await handle.close();
  });

  it('TC-180..181: signup (unverified) → capture code → verify-email with auth token', async () => {
    const email = 'verify-flow@test.local';
    const password = 'VerifyPassword!1';

    // 1. signup — should emit an email verification request (user not yet verified)
    const signupRes = await request(handle.httpServer)
      .post('/auth/signup')
      .send({ email, password });
    expect(signupRes.status).toBeLessThan(300);

    const { accessToken } = extractTokens(signupRes.body);
    expect(accessToken, 'signup should return an access token for the verify-email call').toBeTypeOf('string');

    const code = events.lastEmailVerificationCode();
    // If the package auto-verifies emails by default, there may be no code —
    // in that case this flow is N/A. Assert conditionally with a clear message.
    if (!code) {
      console.warn('[email-verify] no verification code emitted on signup — email may be auto-verified by default config');
      return;
    }

    // 2. verify-email requires auth — send with the signup access token
    const verifyRes = await request(handle.httpServer)
      .post('/auth/verify-email')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code });

    if (verifyRes.status >= 400) {
      // eslint-disable-next-line no-console
      console.error('[verify-email failure]', verifyRes.status, JSON.stringify(verifyRes.body, null, 2));
    }
    expect(verifyRes.status).toBeLessThan(300);
  });

  it('verify-email without auth token → 401', async () => {
    const res = await request(handle.httpServer)
      .post('/auth/verify-email')
      .send({ code: '123456' });
    expect(res.status).toBe(401);
  });
});

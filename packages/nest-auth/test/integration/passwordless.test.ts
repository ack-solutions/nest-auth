/**
 * Real integration tests for the passwordless (email OTP) login flow + session
 * revocation on logout.
 *
 * NO MOCKS. The OTP code is captured off the emitted event (no SMTP needed).
 *
 * Covers: TC-045 (passwordless email OTP), TC-047 (allowSignUp creates user),
 *         TC-127 (logout revokes session).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { attachEventCapture, type EventCapture } from '../helpers/event-capture';

describe('Passwordless email OTP login — TC-045, TC-047', () => {
  let handle: TestAppHandle;
  let events: EventCapture;

  beforeEach(async () => {
    handle = await bootTestApp({
      nestAuth: {
        passwordless: { enabled: true, allowSignUp: true } as any,
      },
    });
    events = attachEventCapture(handle);
  });

  afterEach(async () => {
    await handle.close();
  });

  it('TC-045/047: send code → login with passwordless code → tokens (auto-signup)', async () => {
    const email = 'passwordless@test.local';

    // 1. send the passwordless code
    const sendRes = await request(handle.httpServer)
      .post('/auth/passwordless/send')
      .send({ identifier: email, channel: 'email' });

    if (sendRes.status >= 400) {
      // eslint-disable-next-line no-console
      console.error('[passwordless send failure]', sendRes.status, JSON.stringify(sendRes.body, null, 2));
    }
    expect(sendRes.status).toBeLessThan(300);

    // 2. capture the plaintext code from the emitted event
    const code = events.lastPasswordlessCode();
    expect(code, `no passwordless code captured. Events: ${events.all().map((e) => e.name).join(', ')}`)
      .toBeTypeOf('string');

    // 3. login with the passwordless provider
    const loginRes = await request(handle.httpServer)
      .post('/auth/login')
      .send({
        providerName: 'passwordless',
        credentials: { identifier: email, channels: ['email'], code },
      });

    if (loginRes.status >= 400) {
      // eslint-disable-next-line no-console
      console.error('[passwordless login failure]', loginRes.status, JSON.stringify(loginRes.body, null, 2));
    }
    expect(loginRes.status).toBeLessThan(300);
    const accessToken = loginRes.body.accessToken ?? loginRes.body.tokens?.accessToken;
    expect(accessToken).toBeTypeOf('string');
  });

  it('passwordless login with a WRONG code → 401', async () => {
    const email = 'passwordless-wrong@test.local';
    await request(handle.httpServer)
      .post('/auth/passwordless/send')
      .send({ identifier: email, channel: 'email' });

    const loginRes = await request(handle.httpServer)
      .post('/auth/login')
      .send({
        providerName: 'passwordless',
        credentials: { identifier: email, channels: ['email'], code: '000000' },
      });

    // Passwordless returns 400 (VERIFICATION_CODE_INVALID) for a bad code;
    // email/phone return 401. Both are 4xx rejections.
    expect(loginRes.status).toBeGreaterThanOrEqual(400);
    expect(loginRes.status).toBeLessThan(500);
  });
});

describe('Session revocation on logout — TC-127', () => {
  let handle: TestAppHandle;

  beforeEach(async () => {
    handle = await bootTestApp();
  });

  afterEach(async () => {
    await handle.close();
  });

  it('after logout, the access token no longer works on a guarded route', async () => {
    // signup → token
    const signup = await request(handle.httpServer)
      .post('/auth/signup')
      .send({ email: 'session-revoke@test.local', password: 'SessionPass!1' });
    const token = signup.body.accessToken ?? signup.body.tokens?.accessToken;

    // /me works before logout
    const meBefore = await request(handle.httpServer)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(meBefore.status).toBe(200);

    // logout
    const logout = await request(handle.httpServer)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(logout.status).toBeLessThan(300);

    // /me should now fail — session revoked (guard validates the session record)
    const meAfter = await request(handle.httpServer)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    if (meAfter.status === 200) {
      // eslint-disable-next-line no-console
      console.warn('[session-revoke] /me still 200 after logout — access token may be stateless until expiry');
    }
    // Session-backed guards should reject; document the actual behaviour.
    expect([401, 403]).toContain(meAfter.status);
  });
});

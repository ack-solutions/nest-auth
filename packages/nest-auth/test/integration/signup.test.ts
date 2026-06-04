/**
 * Real integration tests for POST /auth/signup.
 *
 * NO MOCKS. Real NestJS + real TypeORM (sqljs) + real bcrypt + real JWT.
 *
 * Covers (subset of test-catalog §A.1):
 *   TC-001 — email+password signup returns tokens
 *   TC-002 — duplicate email → 4xx
 *   TC-003 — invalid email format → 400
 *   TC-004 — weak password → 400
 *   TC-006 — phone+password signup
 *   TC-007 — neither email nor phone → 400
 *
 * Per-test-file isolation: bootTestApp uses `dropSchema: true`, fresh DB per file.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

/** Helper: extract tokens regardless of where they're nested in the response */
function extractTokens(body: any): { accessToken?: string; refreshToken?: string } {
  return {
    accessToken: body?.accessToken ?? body?.tokens?.accessToken ?? body?.data?.accessToken,
    refreshToken: body?.refreshToken ?? body?.tokens?.refreshToken ?? body?.data?.refreshToken,
  };
}

describe('POST /auth/signup — TC-001..TC-007', () => {
  let handle: TestAppHandle;

  beforeAll(async () => {
    handle = await bootTestApp();
  });

  afterAll(async () => {
    await handle.close();
  });

  describe('TC-001: email+password happy path', () => {
    it('creates user and returns auth tokens (response shape per AuthResponseDto)', async () => {
      const res = await request(handle.httpServer)
        .post('/auth/signup')
        .send({ email: 'tc001@test.local', password: 'StrongPassword!1' });

      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);

      const { accessToken, refreshToken } = extractTokens(res.body);
      expect(accessToken).toBeTypeOf('string');
      expect(refreshToken).toBeTypeOf('string');
      expect(accessToken!.split('.').length).toBe(3); // JWT shape
      expect(res.body.isRequiresMfa).toBe(false);
    });

    it('plaintext password is NEVER in the response body (regression for .tasks/002)', async () => {
      const password = 'UniqueSecret_TC001_!9z';
      const res = await request(handle.httpServer)
        .post('/auth/signup')
        .send({ email: 'tc001-leak@test.local', password });

      expect(JSON.stringify(res.body)).not.toContain(password);
    });
  });

  describe('TC-002: duplicate email → 4xx conflict', () => {
    it('rejects second signup with the same email', async () => {
      const payload = { email: 'tc002@test.local', password: 'StrongPassword!1' };

      const first = await request(handle.httpServer).post('/auth/signup').send(payload);
      expect(first.status).toBeGreaterThanOrEqual(200);
      expect(first.status).toBeLessThan(300);

      const dupe = await request(handle.httpServer).post('/auth/signup').send(payload);
      expect(dupe.status).toBeGreaterThanOrEqual(400);
      expect(dupe.status).toBeLessThan(500);
      expect(JSON.stringify(dupe.body)).not.toContain(payload.password);
    });
  });

  describe('TC-003: invalid email format → 400', () => {
    it('rejects non-email string', async () => {
      const res = await request(handle.httpServer)
        .post('/auth/signup')
        .send({ email: 'not-an-email', password: 'StrongPassword!1' });
      expect(res.status).toBe(400);
    });

    it('rejects empty email string', async () => {
      const res = await request(handle.httpServer)
        .post('/auth/signup')
        .send({ email: '', password: 'StrongPassword!1' });
      expect(res.status).toBe(400);
    });
  });

  describe('TC-004: weak / missing password → 400', () => {
    it('rejects password shorter than 8 characters', async () => {
      const res = await request(handle.httpServer)
        .post('/auth/signup')
        .send({ email: 'tc004@test.local', password: 'short' });
      expect(res.status).toBe(400);
    });

    it('rejects missing password', async () => {
      const res = await request(handle.httpServer)
        .post('/auth/signup')
        .send({ email: 'tc004b@test.local' });
      expect(res.status).toBe(400);
    });
  });

  describe('TC-006: phone+password signup', () => {
    it('accepts phone instead of email and returns tokens or a documented MFA flag', async () => {
      const res = await request(handle.httpServer)
        .post('/auth/signup')
        .send({ phone: '+15551234567', password: 'StrongPassword!1' });

      // BUG-CATCH: phone signup currently returns 500.
      // If this fails, the response body is captured below for diagnosis.
      if (res.status >= 500) {
        console.error('[TC-006 phone signup 500]', JSON.stringify(res.body, null, 2));
      }

      expect(res.status, `phone signup expected 2xx, got ${res.status}: ${JSON.stringify(res.body)}`)
        .toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
    });
  });

  describe('TC-007: missing identity → 400', () => {
    it('rejects when neither email nor phone provided', async () => {
      const res = await request(handle.httpServer)
        .post('/auth/signup')
        .send({ password: 'StrongPassword!1' });
      expect(res.status).toBe(400);
    });
  });

  describe('ValidationPipe whitelist enforcement', () => {
    it('rejects payload with arbitrary extra field', async () => {
      const res = await request(handle.httpServer)
        .post('/auth/signup')
        .send({
          email: 'whitelist@test.local',
          password: 'StrongPassword!1',
          unknownField: 'should-be-rejected',
        });
      expect(res.status).toBe(400);
    });
  });
});

describe('POST /auth/login — TC-030 (after signup)', () => {
  let handle: TestAppHandle;

  beforeAll(async () => {
    handle = await bootTestApp();
  });

  afterAll(async () => {
    await handle.close();
  });

  it('TC-030: user can login after signing up (round-trip)', async () => {
    const email = 'login-rt@test.local';
    const password = 'RoundTrip_Pass_!1';

    const signupRes = await request(handle.httpServer)
      .post('/auth/signup')
      .send({ email, password });

    expect(signupRes.status, `signup setup failed: ${JSON.stringify(signupRes.body)}`)
      .toBeLessThan(300);

    const loginRes = await request(handle.httpServer)
      .post('/auth/login')
      .send({
        providerName: 'email',
        credentials: { email, password },
      });

    // BUG-CATCH: capture diagnostic info if login fails
    if (loginRes.status >= 400) {
      console.error('[TC-030 login failure]', loginRes.status, JSON.stringify(loginRes.body, null, 2));
    }

    expect(loginRes.status, `login after signup expected 2xx, got ${loginRes.status}: ${JSON.stringify(loginRes.body)}`)
      .toBeGreaterThanOrEqual(200);
    expect(loginRes.status).toBeLessThan(300);

    const { accessToken, refreshToken } = extractTokens(loginRes.body);
    expect(accessToken).toBeTypeOf('string');
    expect(refreshToken).toBeTypeOf('string');
  });
});

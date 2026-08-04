/**
 * TOTP enrolment must produce an otpauth:// URI that authenticator apps display
 * correctly — the configured issuer + a real account label — NOT speakeasy's
 * default "SecretKey". Also covers the custom-label override (multi-tenant).
 *
 * NO MOCKS — real NestJS + real DB + real HTTP.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

const ISSUER = 'My Test App';
const PW = 'StrongPass!1word';

let handle: TestAppHandle;

beforeAll(async () => {
  handle = await bootTestApp({
    nestAuth: {
      appName: ISSUER,
      mfa: {
        enabled: true,
        methods: ['totp'],
        allowUserToggle: true,
        totp: { issuer: ISSUER, period: 30 },
      } as any,
    },
  });
});
afterAll(async () => { await handle?.close(); });

async function signup(email: string): Promise<string> {
  const res = await request(handle.httpServer).post('/auth/signup').send({ email, password: PW });
  expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);
  return res.body.accessToken ?? res.body.tokens?.accessToken;
}

describe('TOTP otpauth URI — issuer + account label', () => {
  it('uses the configured issuer and the user email (never "SecretKey")', async () => {
    const email = 'totp-label@test.local';
    const token = await signup(email);

    const res = await request(handle.httpServer)
      .post('/auth/mfa/setup-totp')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.issuer).toBe(ISSUER);
    expect(res.body.account).toBe(email);

    const uri = decodeURIComponent(res.body.otpAuthUrl);
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain(ISSUER);   // issuer present
    expect(uri).toContain(email);    // account label present
    expect(uri).toContain('period=30');
    expect(res.body.otpAuthUrl).not.toContain('SecretKey'); // the old bug
  });

  it('honors a custom label (e.g. tenant-qualified) for multi-account users', async () => {
    const email = 'totp-tenant@test.local';
    const token = await signup(email);
    const customLabel = 'totp-tenant@test.local (Acme Corp)';

    const res = await request(handle.httpServer)
      .post('/auth/mfa/setup-totp')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: customLabel });

    expect(res.status).toBe(200);
    expect(res.body.account).toBe(customLabel);
    expect(res.body.issuer).toBe(ISSUER);
    expect(decodeURIComponent(res.body.otpAuthUrl)).toContain(customLabel);
  });
});

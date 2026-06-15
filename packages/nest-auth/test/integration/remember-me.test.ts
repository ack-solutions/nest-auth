/**
 * Real integration tests for "remember me" (cookie mode).
 *
 * `login({ rememberMe: false })` must issue SESSION cookies (no Max-Age, cleared
 * on browser close) — good for shared devices — and that choice must be STICKY
 * across token refresh (so the first refresh doesn't silently upgrade to
 * persistent cookies). Default / `rememberMe: true` keeps persistent cookies.
 *
 * NO MOCKS — asserts against the real Set-Cookie headers.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

const PASSWORD = 'Remember!1';

const setCookies = (res: request.Response): string[] =>
  ((res.headers['set-cookie'] as unknown as string[]) || []);
const cookie = (headers: string[], name: string) => headers.find((h) => h.startsWith(`${name}=`));
const hasMaxAge = (c?: string) => !!c && /max-age=\d/i.test(c);

describe('remember me — cookie mode', () => {
  let handle: TestAppHandle;
  const server = () => handle.httpServer;

  beforeAll(async () => {
    handle = await bootTestApp({ nestAuth: { session: { accessTokenType: 'cookie' } as any } });
  });
  afterAll(async () => {
    await handle.close();
  });

  const signup = (email: string) =>
    request(server()).post('/auth/signup').send({ email, password: PASSWORD });
  const login = (email: string, extra: Record<string, unknown> = {}) =>
    request(server())
      .post('/auth/login')
      .send({ providerName: 'email', credentials: { email, password: PASSWORD }, ...extra });

  it('rememberMe:false issues SESSION cookies (no Max-Age) + a sticky marker', async () => {
    await signup('rm-a@test.local');
    const res = await login('rm-a@test.local', { rememberMe: false });
    expect(res.status).toBeLessThan(300);

    const sc = setCookies(res);
    expect(hasMaxAge(cookie(sc, 'accessToken'))).toBe(false);
    expect(hasMaxAge(cookie(sc, 'refreshToken'))).toBe(false);
    expect(cookie(sc, 'nest_auth_remember')).toBeTruthy(); // marker present
  });

  it('default (no rememberMe) keeps PERSISTENT cookies (Max-Age present)', async () => {
    await signup('rm-b@test.local');
    const res = await login('rm-b@test.local');
    const sc = setCookies(res);
    expect(hasMaxAge(cookie(sc, 'accessToken'))).toBe(true);
    expect(hasMaxAge(cookie(sc, 'refreshToken'))).toBe(true);
  });

  it('the choice is sticky across refresh (no rememberMe on the refresh call)', async () => {
    await signup('rm-c@test.local');
    const loginRes = await login('rm-c@test.local', { rememberMe: false });

    // Build a cookie jar from the login response.
    const jar = new Map<string, string>();
    for (const h of setCookies(loginRes)) {
      const [pair] = h.split(';');
      const i = pair.indexOf('=');
      jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
    const cookieHeader = Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');

    const refreshRes = await request(server())
      .post('/auth/refresh-token')
      .set('Cookie', cookieHeader)
      .send({});
    expect(refreshRes.status).toBeLessThan(300);

    const sc = setCookies(refreshRes);
    // Still session cookies — the marker kept it from upgrading to persistent.
    expect(hasMaxAge(cookie(sc, 'accessToken'))).toBe(false);
    expect(hasMaxAge(cookie(sc, 'refreshToken'))).toBe(false);
  });
});

/**
 * A refresh with NO refresh token (header mode: none in body; cookie mode: no
 * refresh cookie) is UNAUTHENTICATED — it must return 401, not 400.
 *
 * Why it matters: the SDK treats only 401/403 as a definitive "logged out"
 * (everything else is indeterminate/retryable). Returning 400 made a fresh or
 * cleared-storage visitor look indeterminate, so the app got stuck on load
 * instead of showing the login page.
 *
 * NO MOCKS — real NestJS + real DB + real HTTP.
 */
import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

let handle: TestAppHandle;
afterEach(async () => { await handle?.close(); });

describe('POST /auth/refresh-token with no token → 401 (not 400)', () => {
  it('header mode: empty body → 401 REFRESH_TOKEN_INVALID', async () => {
    handle = await bootTestApp({ nestAuth: { session: { accessTokenType: 'header' } } as any });
    const res = await request(handle.httpServer).post('/auth/refresh-token').send({});
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).toContain('REFRESH_TOKEN_INVALID');
  });

  it('cookie mode: no refresh cookie → 401', async () => {
    handle = await bootTestApp({ nestAuth: { session: { accessTokenType: 'cookie' } } as any });
    const res = await request(handle.httpServer).post('/auth/refresh-token').send({});
    expect(res.status).toBe(401);
  });

  it('a garbage (non-empty) refresh token still → 401 (parity, unchanged)', async () => {
    handle = await bootTestApp({ nestAuth: { session: { accessTokenType: 'header' } } as any });
    const res = await request(handle.httpServer).post('/auth/refresh-token').send({ refreshToken: 'not-a-real-token' });
    expect(res.status).toBe(401);
  });
});

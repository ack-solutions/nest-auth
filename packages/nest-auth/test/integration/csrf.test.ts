/**
 * Regression tests for CSRF protection on cookie-authenticated requests (#12).
 *
 * NO MOCKS. Real NestJS + real DB. A supertest agent persists cookies (the
 * httpOnly session cookie + the non-httpOnly double-submit CSRF cookie) exactly
 * like a browser, so we can prove a state-changing request is rejected without a
 * matching CSRF token and accepted with one.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

const PW = 'CsrfPass!1';

describe('CSRF — cookie mode enforcement (#12)', () => {
  let handle: TestAppHandle;

  beforeEach(async () => {
    handle = await bootTestApp({
      nestAuth: {
        session: { accessTokenType: 'cookie', cookieOptions: { secure: false } } as any,
        security: { csrf: { enabled: true } } as any,
      },
    });
  });
  afterEach(async () => { await handle.close(); });

  async function login(agent: any, email: string) {
    await agent.post('/auth/signup').send({ email, password: PW });
    const res = await agent.post('/auth/login').send({ providerName: 'email', credentials: { email, password: PW } });
    expect(res.status, `login failed: ${JSON.stringify(res.body)}`).toBeLessThan(300);
  }

  it('rejects a cookie-authenticated POST with NO CSRF token (403)', async () => {
    const agent = request.agent(handle.httpServer);
    await login(agent, 'csrf-none@test.local');

    const res = await agent.post('/auth/logout').send({});
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).toContain('CSRF_TOKEN_INVALID');
  });

  it('rejects a MISMATCHED CSRF header (403)', async () => {
    const agent = request.agent(handle.httpServer);
    await login(agent, 'csrf-bad@test.local');
    await agent.get('/auth/csrf'); // sets the cookie to a real token

    const res = await agent.post('/auth/logout').set('x-csrf-token', 'not-the-right-token').send({});
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).toContain('CSRF_TOKEN_INVALID');
  });

  it('accepts the POST when the CSRF header matches the cookie', async () => {
    const agent = request.agent(handle.httpServer);
    await login(agent, 'csrf-ok@test.local');

    const csrf = await agent.get('/auth/csrf');
    expect(csrf.status).toBe(200);
    expect(csrf.body.enabled).toBe(true);
    expect(csrf.body.csrfToken).toBeTypeOf('string');

    const res = await agent.post('/auth/logout').set('x-csrf-token', csrf.body.csrfToken).send({});
    expect(res.status, `expected non-CSRF success, got ${res.status} ${JSON.stringify(res.body)}`).toBeLessThan(400);
  });

  it('GET (safe method) is never CSRF-blocked', async () => {
    const agent = request.agent(handle.httpServer);
    await login(agent, 'csrf-get@test.local');
    const res = await agent.get('/auth/me');
    expect(res.status).toBe(200);
  });
});

describe('CSRF — bearer/header auth is immune', () => {
  let handle: TestAppHandle;
  beforeEach(async () => {
    // Header mode (default) + CSRF enabled.
    handle = await bootTestApp({ nestAuth: { security: { csrf: { enabled: true } } } as any });
  });
  afterEach(async () => { await handle.close(); });

  it('allows a Bearer-authenticated POST with no CSRF token', async () => {
    const email = 'csrf-bearer@test.local';
    await request(handle.httpServer).post('/auth/signup').send({ email, password: PW });
    const login = await request(handle.httpServer)
      .post('/auth/login')
      .send({ providerName: 'email', credentials: { email, password: PW } });
    const token = login.body.accessToken ?? login.body.tokens?.accessToken;
    expect(token).toBeTypeOf('string');

    const res = await request(handle.httpServer)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBeLessThan(400); // header auth → CSRF not applied
  });
});

describe('CSRF — Origin/Referer allowlist', () => {
  let handle: TestAppHandle;
  beforeEach(async () => {
    handle = await bootTestApp({
      nestAuth: {
        session: { accessTokenType: 'cookie', cookieOptions: { secure: false } } as any,
        security: { csrf: { enabled: true, allowedOrigins: ['https://good.example'] } } as any,
      },
    });
  });
  afterEach(async () => { await handle.close(); });

  it('rejects a cross-site Origin even with a valid double-submit token (403)', async () => {
    const agent = request.agent(handle.httpServer);
    await agent.post('/auth/signup').send({ email: 'csrf-origin@test.local', password: PW });
    await agent.post('/auth/login').send({ providerName: 'email', credentials: { email: 'csrf-origin@test.local', password: PW } });
    const csrf = await agent.get('/auth/csrf');

    const res = await agent
      .post('/auth/logout')
      .set('x-csrf-token', csrf.body.csrfToken)
      .set('Origin', 'https://evil.example')
      .send({});
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).toContain('CSRF_ORIGIN_REJECTED');
  });
});

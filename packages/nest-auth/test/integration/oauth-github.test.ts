/**
 * Real integration tests for GitHub OAuth login.
 *
 * NO MOCKS. A real local HTTP server stands in for the GitHub API (configured
 * via the new `github.userApiUrl` / `github.emailsApiUrl` options). The auth
 * code makes real `fetch` calls to it. Real DB, real JWT.
 *
 * Covers: TC-065 (extract primary verified email), TC-066 (no email → 422-ish),
 *         social-login auto-create + repeat-login same-user.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

/** A real GitHub-API stub. Tests set `ghUser` / `ghEmails` before each request. */
let server: Server;
let baseUrl: string;
let ghUser: any = null;
let ghEmails: any[] = [];
let userStatus = 200;

beforeAll(async () => {
  server = createServer((req, res) => {
    const send = (status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    };
    if (req.url === '/user') {
      if (userStatus !== 200) return send(userStatus, { message: 'forced' });
      return send(200, ghUser ?? { message: 'no user' });
    }
    if (req.url === '/user/emails') return send(200, ghEmails);
    send(404, { message: 'not found' });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

describe('GitHub OAuth login', () => {
  let handle: TestAppHandle;

  beforeEach(async () => {
    ghUser = null;
    ghEmails = [];
    userStatus = 200;
    handle = await bootTestApp({
      nestAuth: {
        github: {
          clientId: 'test-client',
          clientSecret: 'test-secret',
          redirectUri: 'http://localhost/cb',
          userApiUrl: `${baseUrl}/user`,
          emailsApiUrl: `${baseUrl}/user/emails`,
        } as any,
      },
    });
  });

  afterEach(async () => {
    await handle.close();
  });

  it('TC-065: first GitHub login auto-creates the user and returns tokens', async () => {
    ghUser = { id: 4242, login: 'octocat', name: 'The Octocat', email: 'octo@github.test' };

    const res = await request(handle.httpServer)
      .post('/auth/login')
      .send({
        providerName: 'github',
        credentials: { token: 'gh-access-token' },
        createUserIfNotExists: true,
      });

    if (res.status >= 400) {
      // eslint-disable-next-line no-console
      console.error('[github login failure]', res.status, JSON.stringify(res.body, null, 2));
    }
    expect(res.status).toBeLessThan(300);
    const accessToken = res.body.accessToken ?? res.body.tokens?.accessToken;
    expect(accessToken).toBeTypeOf('string');
  });

  it('second login with the same GitHub id returns the SAME user (no duplicate)', async () => {
    ghUser = { id: 5555, login: 'repeat', name: 'Repeat User', email: 'repeat@github.test' };

    const first = await request(handle.httpServer)
      .post('/auth/login')
      .send({ providerName: 'github', credentials: { token: 't1' }, createUserIfNotExists: true });
    expect(first.status).toBeLessThan(300);

    const second = await request(handle.httpServer)
      .post('/auth/login')
      .send({ providerName: 'github', credentials: { token: 't2' }, createUserIfNotExists: true });
    expect(second.status).toBeLessThan(300);

    // Exactly one user should exist with that email
    const ds = handle.get(require('typeorm').DataSource);
    const rows = await ds.query(
      `SELECT COUNT(*) as c FROM nest_auth_users WHERE email = 'repeat@github.test'`,
    );
    expect(Number(rows[0].c)).toBe(1);
  });

  it('TC-065: falls back to /user/emails for a verified primary when profile email is private', async () => {
    ghUser = { id: 6, login: 'private-email', name: 'Private', email: null };
    ghEmails = [
      { email: 'secondary@github.test', primary: false, verified: true, visibility: 'private' },
      { email: 'primary@github.test', primary: true, verified: true, visibility: 'private' },
    ];

    const res = await request(handle.httpServer)
      .post('/auth/login')
      .send({ providerName: 'github', credentials: { token: 't' }, createUserIfNotExists: true });

    expect(res.status).toBeLessThan(300);

    const ds = handle.get(require('typeorm').DataSource);
    const rows = await ds.query(
      `SELECT email FROM nest_auth_users WHERE email = 'primary@github.test'`,
    );
    expect(rows.length).toBe(1);
  });

  it('TC-066: GitHub token valid but NO usable email → 4xx with OAUTH_EMAIL_NOT_PUBLIC', async () => {
    ghUser = { id: 7, login: 'no-email', name: 'No Email', email: null };
    ghEmails = []; // no emails at all

    const res = await request(handle.httpServer)
      .post('/auth/login')
      .send({ providerName: 'github', credentials: { token: 't' }, createUserIfNotExists: true });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(JSON.stringify(res.body)).toContain('OAUTH_EMAIL_NOT_PUBLIC');
  });

  it('GitHub rejects the token (401) → login fails 4xx', async () => {
    userStatus = 401;
    const res = await request(handle.httpServer)
      .post('/auth/login')
      .send({ providerName: 'github', credentials: { token: 'bad' }, createUserIfNotExists: true });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  // Account-linking takeover guard (audit #6): a social login whose email matches
  // an EXISTING local account must not auto-attach unless the provider verified it.
  it('BLOCKS auto-linking to an existing account when the provider email is UNVERIFIED', async () => {
    const email = 'link-victim@github.test';
    const signup = await request(handle.httpServer).post('/auth/signup').send({ email, password: 'Victim!123' });
    expect(signup.status).toBeLessThan(300);

    // GitHub asserts the SAME email but as a private, UNVERIFIED address.
    ghUser = { id: 9001, login: 'attacker', name: 'Attacker', email: null };
    ghEmails = [{ email, primary: true, verified: false, visibility: 'private' }];

    const res = await request(handle.httpServer)
      .post('/auth/login')
      .send({ providerName: 'github', credentials: { token: 'attacker-token' }, createUserIfNotExists: true });

    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).toContain('SOCIAL_EMAIL_NOT_VERIFIED');
  });

  it('ALLOWS linking to an existing account when the provider VERIFIED the email', async () => {
    const email = 'link-owner@github.test';
    const signup = await request(handle.httpServer).post('/auth/signup').send({ email, password: 'Owner!123' });
    expect(signup.status).toBeLessThan(300);

    // A public GitHub profile email is verified by definition.
    ghUser = { id: 9002, login: 'owner', name: 'Owner', email };

    const res = await request(handle.httpServer)
      .post('/auth/login')
      .send({ providerName: 'github', credentials: { token: 'owner-token' }, createUserIfNotExists: true });

    expect(res.status).toBeLessThan(300);
    expect(res.body.accessToken ?? res.body.tokens?.accessToken).toBeTypeOf('string');
  });
});

/**
 * OAuth stub server for real integration tests (T-015).
 *
 * NO MOCKS POLICY: this is a REAL HTTP server (Node's `http` module) that
 * implements the documented response shapes of Google / GitHub / Facebook
 * / Apple OAuth endpoints. Tests boot it on a random port and configure the
 * auth providers to hit it instead of the real provider URLs.
 *
 * Usage:
 *
 * ```ts
 * import { setupOAuthStubServer } from '@ackplus/vitest-preset/helpers/oauth-stub';
 *
 * describe('Google OAuth', () => {
 *   const stub = setupOAuthStubServer();
 *
 *   beforeEach(() => {
 *     stub.setGoogleUser({ sub: 'g-1', email: 'g@x', email_verified: true });
 *   });
 *
 *   it('signs in via Google', async () => {
 *     const handle = await bootTestApp({
 *       nestAuth: { google: { clientId: 'x', userinfoUrl: stub.googleUserinfoUrl() } }
 *     });
 *     // ... POST /auth/oauth/google with accessToken
 *   });
 * });
 * ```
 *
 * **Note:** This stub requires the auth providers to support URL-override config
 * (planned as part of Phase 2 / plugin-architecture work). Until then, the stub
 * is infrastructure waiting for the consumer-side hooks.
 */

import { createServer } from 'node:http';
import { beforeAll, afterAll } from 'vitest';

/**
 * @typedef {Object} GoogleUserinfo
 * @property {string} sub
 * @property {string} email
 * @property {boolean} [email_verified]
 * @property {string} [name]
 * @property {string} [picture]
 * @property {string} [locale]
 *
 * @typedef {Object} GitHubUser
 * @property {number|string} id
 * @property {string} login
 * @property {string} [name]
 * @property {string} [avatar_url]
 * @property {string} [email]
 *
 * @typedef {Object} GitHubEmail
 * @property {string} email
 * @property {boolean} primary
 * @property {boolean} verified
 * @property {string} visibility
 */

/**
 * @param {Object} [opts]
 * @param {boolean} [opts.installHooks] - Install vitest beforeAll/afterAll automatically. Default true.
 * @returns {OAuthStubHandle}
 */
export function setupOAuthStubServer(opts = {}) {
  const { installHooks = true } = opts;

  /** @type {GoogleUserinfo | null} */
  let googleUser = null;
  /** @type {{ user: GitHubUser, emails: GitHubEmail[], shouldFail?: number } | null} */
  let githubResponse = null;
  /** @type {{ id: string, email?: string, name?: { first_name?: string, last_name?: string } } | null} */
  let facebookUser = null;

  /** @type {import('node:http').Server | null} */
  let server = null;
  let port = 0;

  /** Tracks requests for assertions */
  const requestLog = [];

  async function start() {
    if (server) return;
    server = createServer((req, res) => {
      const url = req.url || '/';
      const method = req.method || 'GET';
      requestLog.push({ method, url, headers: req.headers });

      // Helper to write JSON response
      const send = (status, body) => {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(body));
      };

      // ── Google ────────────────────────────────────────────────────────
      // GET /oauth2/v3/userinfo
      if (method === 'GET' && url.startsWith('/google/userinfo')) {
        if (!googleUser) return send(401, { error: 'invalid_token' });
        return send(200, googleUser);
      }
      // GET /tokeninfo?access_token=...  (Google's token-info endpoint)
      if (method === 'GET' && url.startsWith('/google/tokeninfo')) {
        if (!googleUser) return send(400, { error: 'invalid_token' });
        return send(200, {
          sub: googleUser.sub,
          email: googleUser.email,
          email_verified: String(googleUser.email_verified ?? true),
          aud: 'test-client-id',
        });
      }

      // ── GitHub ────────────────────────────────────────────────────────
      // GET /user
      if (method === 'GET' && url === '/github/user') {
        if (!githubResponse) return send(401, { message: 'Bad credentials' });
        if (githubResponse.shouldFail) return send(githubResponse.shouldFail, { message: 'Forced failure' });
        return send(200, githubResponse.user);
      }
      // GET /user/emails
      if (method === 'GET' && url === '/github/user/emails') {
        if (!githubResponse) return send(401, { message: 'Bad credentials' });
        return send(200, githubResponse.emails);
      }

      // ── Facebook ──────────────────────────────────────────────────────
      // GET /me?fields=...
      if (method === 'GET' && url.startsWith('/facebook/me')) {
        if (!facebookUser) return send(400, { error: { message: 'Invalid token' } });
        return send(200, facebookUser);
      }

      // ── Health check ──────────────────────────────────────────────────
      if (method === 'GET' && url === '/__health') {
        return send(200, { ok: true });
      }

      send(404, { error: `OAuth stub: no handler for ${method} ${url}` });
    });

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        port = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });
  }

  async function stop() {
    if (!server) return;
    await new Promise((resolve) => server.close(() => resolve()));
    server = null;
    port = 0;
  }

  if (installHooks) {
    beforeAll(async () => {
      await start();
    });
    afterAll(async () => {
      await stop();
    });
  }

  return {
    start,
    stop,

    /** Returns the base URL (e.g. http://127.0.0.1:54321). */
    baseUrl: () => `http://127.0.0.1:${port}`,

    // ── URL helpers consumers can pass to auth provider config ──────────
    googleUserinfoUrl: () => `http://127.0.0.1:${port}/google/userinfo`,
    googleTokeninfoUrl: () => `http://127.0.0.1:${port}/google/tokeninfo`,
    githubUserUrl: () => `http://127.0.0.1:${port}/github/user`,
    githubEmailsUrl: () => `http://127.0.0.1:${port}/github/user/emails`,
    facebookMeUrl: (fields = 'id,email,name') =>
      `http://127.0.0.1:${port}/facebook/me?fields=${encodeURIComponent(fields)}`,

    // ── Fixture setters ─────────────────────────────────────────────────
    /** @param {GoogleUserinfo | null} user */
    setGoogleUser(user) {
      googleUser = user;
    },
    /** @param {{ user: GitHubUser, emails: GitHubEmail[], shouldFail?: number } | null} resp */
    setGithubResponse(resp) {
      githubResponse = resp;
    },
    /** @param {{ id: string, email?: string, name?: { first_name?: string, last_name?: string } } | null} user */
    setFacebookUser(user) {
      facebookUser = user;
    },

    // ── Assertion helpers ───────────────────────────────────────────────
    /** All requests seen since last `clearRequests()`. */
    requests: () => [...requestLog],
    requestsTo: (urlPrefix) => requestLog.filter((r) => r.url.startsWith(urlPrefix)),
    clearRequests: () => {
      requestLog.length = 0;
    },
  };
}

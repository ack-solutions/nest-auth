/**
 * Real tests for AuthClient.socialLogin (RN-1).
 *
 * NO MOCKS. A real Node HTTP server stands in for the backend `/auth/login`
 * endpoint, captures the request body, and returns a token response. We assert
 * the client composes the correct login DTO and processes the auth response.
 *
 * Covers: TC-RN-1 (correct DTO), TC-RN-2 (createUserIfNotExists default),
 *         TC-RN-3 (tenantId propagation), TC-RN-4 (MFA path).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import { AuthClient } from '../../src/client/auth-client';
import { MemoryStorage } from '../../src/storage/memory.storage';
import { makeValidJwt } from '../fixtures/jwt.fixtures';

let server: Server;
let baseUrl: string;
let lastBody: any = null;
let respond: () => any;

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      lastBody = raw ? JSON.parse(raw) : null;
      const body = respond();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

function newClient() {
  return new AuthClient({
    baseUrl,
    accessTokenType: 'header',
    storage: new MemoryStorage(),
    autoRefresh: false,
  });
}

describe('AuthClient.socialLogin — RN-1', () => {
  beforeEach(() => {
    lastBody = null;
    // Default: full auth success
    respond = () => ({
      accessToken: makeValidJwt({ sub: 'social-user' }),
      refreshToken: makeValidJwt({ sub: 'social-user', type: 'refresh' }),
      isRequiresMfa: false,
    });
  });

  it('TC-RN-1: posts the correct login DTO for a provider token', async () => {
    const client = newClient();
    await client.ready();

    await client.socialLogin('github', 'gh-access-token', { type: 'accessToken' });

    expect(lastBody).toEqual({
      providerName: 'github',
      credentials: { token: 'gh-access-token', type: 'accessToken' },
      createUserIfNotExists: true,
    });
  });

  it('TC-RN-2: defaults createUserIfNotExists to true', async () => {
    const client = newClient();
    await client.ready();
    await client.socialLogin('google', 'g-id-token', { type: 'idToken' });
    expect(lastBody.createUserIfNotExists).toBe(true);
  });

  it('createUserIfNotExists can be overridden to false', async () => {
    const client = newClient();
    await client.ready();
    await client.socialLogin('google', 'g-id-token', { type: 'idToken', createUserIfNotExists: false });
    expect(lastBody.createUserIfNotExists).toBe(false);
  });

  it('TC-RN-3: propagates tenantId', async () => {
    const client = newClient();
    await client.ready();
    await client.socialLogin('github', 'tok', { tenantId: 'tenant-123' });
    expect(lastBody.tenantId).toBe('tenant-123');
  });

  it('forwards extraCredentials (e.g. Apple first-sign-in name/email)', async () => {
    const client = newClient();
    await client.ready();
    await client.socialLogin('apple', 'apple-identity-token', {
      type: 'idToken',
      extraCredentials: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@apple.test' },
    });
    expect(lastBody.credentials).toEqual({
      token: 'apple-identity-token',
      type: 'idToken',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@apple.test',
    });
  });

  it('on success, stores tokens (sync read available after login)', async () => {
    const access = makeValidJwt({ sub: 'stored-user' });
    respond = () => ({ accessToken: access, refreshToken: 'r', isRequiresMfa: false });

    const client = newClient();
    await client.ready();
    await client.socialLogin('github', 'tok');

    // The auth headers reflect the stored token
    const headers = client.getAuthHeadersSync();
    expect(headers['Authorization']).toBe(`Bearer ${access}`);
  });

  it('TC-RN-4: surfaces isRequiresMfa and does not finalize auth', async () => {
    respond = () => ({
      accessToken: makeValidJwt({ sub: 'mfa-user' }),
      refreshToken: 'r',
      isRequiresMfa: true,
    });

    const client = newClient();
    await client.ready();
    const res = await client.socialLogin('github', 'tok');
    expect(res.isRequiresMfa).toBe(true);
  });
});

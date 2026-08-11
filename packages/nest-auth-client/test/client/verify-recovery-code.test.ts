/**
 * AuthClient.verifyRecoveryCode posts the recovery code to
 * /auth/mfa/verify-recovery-code and, on success, processes the auth response
 * (stores the returned session tokens) — exactly like verify2fa.
 *
 * NO MOCKS. A real Node HTTP server stands in for the backend endpoint.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import { AuthClient } from '../../src/client/auth-client';
import { MemoryStorage } from '../../src/storage/memory.storage';
import { makeValidJwt } from '../fixtures/jwt.fixtures';

let server: Server;
let baseUrl: string;
let lastPath: string | null = null;
let lastBody: any = null;
let respondStatus = 200;

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      lastPath = req.url ?? null;
      lastBody = raw ? JSON.parse(raw) : null;
      res.statusCode = respondStatus;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(
        respondStatus === 200
          ? { accessToken: makeValidJwt({ sub: 'u1' }), refreshToken: 'rt-1', message: 'ok' }
          : { message: 'Invalid recovery code', code: 'MFA_RECOVERY_CODE_INVALID' },
      ));
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
  return new AuthClient({ baseUrl, accessTokenType: 'header', storage: new MemoryStorage(), autoRefresh: false });
}

beforeEach(() => { lastPath = null; lastBody = null; respondStatus = 200; });

describe('AuthClient.verifyRecoveryCode', () => {
  it('POSTs { code, trustDevice } to /auth/mfa/verify-recovery-code and stores the session', async () => {
    const client = newClient();
    const res = await client.verifyRecoveryCode({ code: 'my-backup-code', trustDevice: true });

    expect(lastPath).toBe('/auth/mfa/verify-recovery-code');
    expect(lastBody).toEqual({ code: 'my-backup-code', trustDevice: true });
    expect(res.accessToken).toBeTypeOf('string');
    // The returned session was processed and persisted.
    expect(await client.getAccessToken()).toBeTypeOf('string');
    expect(client.getIsAuthenticated()).toBe(true);
  });

  it('throws (and does not authenticate) on a rejected code', async () => {
    const client = newClient();
    respondStatus = 401;
    await expect(client.verifyRecoveryCode({ code: 'bad' })).rejects.toMatchObject({ statusCode: 401 });
    expect(client.getIsAuthenticated()).toBe(false);
  });
});

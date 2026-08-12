/**
 * With NO stored refresh token (a fresh visitor or cleared storage), the client
 * must NOT make a doomed /auth/refresh-token request and must treat the state as
 * a DEFINITIVE rejection (kind 'rejected') — so verifySession() resolves to
 * { valid: false } and the app shows login, instead of getting stuck on an
 * indeterminate outcome.
 *
 * NO MOCKS. A real Node HTTP server counts the requests the client makes.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import { AuthClient } from '../../src/client/auth-client';
import { MemoryStorage } from '../../src/storage/memory.storage';

let server: Server;
let baseUrl: string;
let refreshHits = 0;
let verifyHits = 0;

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      if (req.url === '/auth/refresh-token') refreshHits += 1;
      if (req.url === '/auth/verify-session') verifyHits += 1;
      // No credentials on any request → the backend would answer 401.
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ message: 'unauthorized' }));
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
  return new AuthClient({ baseUrl, accessTokenType: 'header', storage: new MemoryStorage(), autoRefresh: true });
}

beforeEach(() => { refreshHits = 0; verifyHits = 0; });

describe('refresh with no stored token → definitive, no doomed request', () => {
  it('refresh() throws kind "rejected" and makes NO /auth/refresh-token request', async () => {
    const client = newClient();
    await expect(client.refresh()).rejects.toMatchObject({ kind: 'rejected' });
    expect(refreshHits).toBe(0); // short-circuited — no doomed request
  });

  it('verifySession() resolves to { valid: false } (shows login), not an indeterminate throw', async () => {
    const client = newClient();
    await expect(client.verifySession()).resolves.toMatchObject({ valid: false });
    expect(refreshHits).toBe(0); // the refresh was short-circuited
    expect(verifyHits).toBeGreaterThanOrEqual(1); // it did try to verify
  });
});

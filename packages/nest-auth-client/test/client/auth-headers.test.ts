/**
 * Real tests for AuthClient.getAuthHeaders / getAuthHeadersSync (T-167b).
 *
 * NO MOCKS. Real AuthClient, real MemoryStorage, real TokenManager.
 * No HTTP is exercised — these tests verify only the header-shape logic.
 *
 * Covers: TC-token-1 (header attached), TC-token-5 (cookie-mode shape),
 *         TC-token-6 (sync read immediately after setTokens).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuthClient } from '../../src/client/auth-client';
import { MemoryStorage } from '../../src/storage/memory.storage';
import { makeValidJwt } from '../fixtures/jwt.fixtures';

/**
 * Build a real AuthClient for tests. Configures with MemoryStorage so nothing
 * persists between tests; baseUrl is a dummy since these tests don't make HTTP.
 */
function newClient(opts?: Partial<ConstructorParameters<typeof AuthClient>[0]>): AuthClient {
  return new AuthClient({
    baseUrl: 'http://test.local',
    accessTokenType: 'header',
    storage: new MemoryStorage(),
    autoRefresh: false, // we're not testing HTTP refresh here
    ...opts,
  });
}

describe('AuthClient.getAuthHeaders / getAuthHeadersSync — T-167b', () => {
  describe('header mode — happy path', () => {
    let client: AuthClient;

    beforeEach(async () => {
      client = newClient();
      await client.ready();
    });

    it('TC-token-1: getAuthHeadersSync returns Authorization + mode after setTokens', async () => {
      const token = makeValidJwt({ sub: 'u-sync' });
      // setTokens is on TokenManager; access it via the internal field for this test
      // (in real usage, login() calls setTokens internally)
      await (client as any).tokenManager.setTokens({ accessToken: token, refreshToken: 'r' });

      const headers = client.getAuthHeadersSync();
      expect(headers['Authorization']).toBe(`Bearer ${token}`);
      expect(headers['x-access-token-type']).toBe('header');
    });

    it('async getAuthHeaders returns the same shape', async () => {
      const token = makeValidJwt({ sub: 'u-async' });
      await (client as any).tokenManager.setTokens({ accessToken: token, refreshToken: 'r' });

      const headers = await client.getAuthHeaders();
      expect(headers['Authorization']).toBe(`Bearer ${token}`);
      expect(headers['x-access-token-type']).toBe('header');
    });

    it('returns only mode header when not logged in', () => {
      const headers = client.getAuthHeadersSync();
      expect(headers['Authorization']).toBeUndefined();
      expect(headers['x-access-token-type']).toBe('header');
    });
  });

  describe('cookie mode — TC-token-5', () => {
    let client: AuthClient;

    beforeEach(async () => {
      client = newClient({ accessTokenType: 'cookie' });
      await client.ready();
    });

    it('never includes Authorization header in cookie mode', async () => {
      // Even if setTokens were called (it's a no-op in cookie mode), no Authorization
      const sync = client.getAuthHeadersSync();
      const async_ = await client.getAuthHeaders();

      expect(sync['Authorization']).toBeUndefined();
      expect(async_['Authorization']).toBeUndefined();
      expect(sync['x-access-token-type']).toBe('cookie');
      expect(async_['x-access-token-type']).toBe('cookie');
    });

    it('shouldSendCookies() returns true in cookie mode', () => {
      expect(client.shouldSendCookies()).toBe(true);
    });

    it('shouldSendCookies() returns false in header mode', async () => {
      const headerClient = newClient({ accessTokenType: 'header' });
      await headerClient.ready();
      expect(headerClient.shouldSendCookies()).toBe(false);
    });
  });

  describe('trust token', () => {
    it('includes trust token under default header name', async () => {
      const client = newClient();
      await client.ready();
      await (client as any).tokenManager.setTokens({
        accessToken: makeValidJwt({ sub: 'u' }),
        refreshToken: 'r',
      });
      await (client as any).tokenManager.setTrustToken('trust-xyz');

      const headers = client.getAuthHeadersSync();
      expect(headers['nest_auth_device_trust']).toBe('trust-xyz');
    });

    it('respects configured trustDeviceHeaderName', async () => {
      const client = newClient({ trustDeviceHeaderName: 'X-My-Trust' });
      await client.ready();
      await (client as any).tokenManager.setTrustToken('trust-abc');

      const headers = client.getAuthHeadersSync();
      expect(headers['X-My-Trust']).toBe('trust-abc');
      expect(headers['nest_auth_device_trust']).toBeUndefined();
    });

    it('opts.trustHeaderName overrides the configured name', async () => {
      const client = newClient({ trustDeviceHeaderName: 'X-Config' });
      await client.ready();
      await (client as any).tokenManager.setTrustToken('t');

      const headers = client.getAuthHeadersSync({ trustHeaderName: 'X-Call-Override' });
      expect(headers['X-Call-Override']).toBe('t');
      expect(headers['X-Config']).toBeUndefined();
    });

    it('opts.includeTrustToken=false omits the trust header', async () => {
      const client = newClient();
      await client.ready();
      await (client as any).tokenManager.setTrustToken('t');

      const headers = client.getAuthHeadersSync({ includeTrustToken: false });
      expect(headers['nest_auth_device_trust']).toBeUndefined();
    });
  });

  describe('customization options', () => {
    let client: AuthClient;

    beforeEach(async () => {
      client = newClient();
      await client.ready();
      await (client as any).tokenManager.setTokens({
        accessToken: makeValidJwt({ sub: 'u' }),
        refreshToken: 'r',
      });
    });

    it('opts.authHeaderName changes the Authorization header name', () => {
      const headers = client.getAuthHeadersSync({ authHeaderName: 'X-API-Token' });
      expect(headers['X-API-Token']).toMatch(/^Bearer /);
      expect(headers['Authorization']).toBeUndefined();
    });

    it('opts.skipAuthHeader omits Authorization entirely', () => {
      const headers = client.getAuthHeadersSync({ skipAuthHeader: true });
      expect(headers['Authorization']).toBeUndefined();
      expect(headers['x-access-token-type']).toBe('header'); // mode header still present
    });

    it('opts.includeAccessTokenTypeHeader=false omits the mode header', () => {
      const headers = client.getAuthHeadersSync({ includeAccessTokenTypeHeader: false });
      expect(headers['x-access-token-type']).toBeUndefined();
      expect(headers['Authorization']).toBeDefined();
    });

    it('all opts combined: minimal headers only', () => {
      const headers = client.getAuthHeadersSync({
        skipAuthHeader: true,
        includeTrustToken: false,
        includeAccessTokenTypeHeader: false,
      });
      expect(headers).toEqual({});
    });
  });

  describe('mirror warm-up across construction', () => {
    it('sync read works on second AuthClient if storage already has tokens', async () => {
      const sharedStorage = new MemoryStorage();
      const t = makeValidJwt({ sub: 'first' });
      sharedStorage.set('access_token', t);
      sharedStorage.set('refresh_token', 'r');

      // Second client constructed against the same storage
      const client2 = new AuthClient({
        baseUrl: 'http://test.local',
        accessTokenType: 'header',
        storage: sharedStorage,
        autoRefresh: false,
      });
      await client2.ready();

      const headers = client2.getAuthHeadersSync();
      expect(headers['Authorization']).toBe(`Bearer ${t}`);
    });
  });
});

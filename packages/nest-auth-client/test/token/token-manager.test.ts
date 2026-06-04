/**
 * Real tests for token/token-manager.ts — covers the T-167a in-memory mirror.
 *
 * NO MOCKS. Uses the real `MemoryStorage` adapter and a custom `AsyncStorage`
 * implementation (also real — just `async` Promise returns) to verify both
 * sync and async storage paths.
 *
 * Covers: T-167a verification + supplement to TC-440 (memory storage).
 * New TCs filed in cross-system-sync verification: TC-token-6 (mirror immediate sync).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TokenManager } from '../../src/token/token-manager';
import { MemoryStorage } from '../../src/storage/memory.storage';
import type { StorageAdapter } from '../../src/types/config.types';
import { makeValidJwt } from '../fixtures/jwt.fixtures';

/**
 * Real async storage adapter — every method returns a Promise. Models the shape
 * of React Native AsyncStorage. This is not a mock; it's a real impl of the port.
 */
class AsyncMemoryStorage implements StorageAdapter {
  private store = new Map<string, string>();
  // Simulate non-trivial async by yielding to the event loop.
  async get(key: string): Promise<string | null> {
    await Promise.resolve();
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: string): Promise<void> {
    await Promise.resolve();
    this.store.set(key, value);
  }
  async remove(key: string): Promise<void> {
    await Promise.resolve();
    this.store.delete(key);
  }
  async clear(): Promise<void> {
    await Promise.resolve();
    this.store.clear();
  }
  // Test helper: peek inside without going through the adapter contract
  peek(key: string): string | null {
    return this.store.get(key) ?? null;
  }
}

describe('TokenManager — T-167a in-memory mirror', () => {
  let storage: MemoryStorage;
  let tm: TokenManager;

  beforeEach(async () => {
    storage = new MemoryStorage();
    tm = new TokenManager({ storage, accessTokenType: 'header' });
    await tm.ready(); // warm-up resolves immediately on empty storage
  });

  describe('setTokens populates mirror', () => {
    it('TC-token-6: sync read returns the access token immediately after setTokens', async () => {
      const access = makeValidJwt({ sub: 'u-1' });
      const refresh = makeValidJwt({ sub: 'u-1', type: 'refresh' });

      await tm.setTokens({ accessToken: access, refreshToken: refresh });

      // No `await` here — sync read must return the value immediately
      expect(tm.getAccessTokenSync()).toBe(access);
      expect(tm.getRefreshTokenSync()).toBe(refresh);
      expect(tm.getAuthorizationHeaderSync()).toBe(`Bearer ${access}`);
    });

    it('sync read after clearTokens returns null', async () => {
      await tm.setTokens({ accessToken: 'a', refreshToken: 'r' });
      await tm.clearTokens();

      expect(tm.getAccessTokenSync()).toBeNull();
      expect(tm.getRefreshTokenSync()).toBeNull();
      expect(tm.getAuthorizationHeaderSync()).toBeNull();
    });

    it('mirror is the same value as storage after setTokens', async () => {
      await tm.setTokens({ accessToken: 'a-tok', refreshToken: 'r-tok' });

      expect(tm.getAccessTokenSync()).toBe('a-tok');
      expect(storage.get('access_token')).toBe('a-tok'); // direct storage read
    });
  });

  describe('mirror warm-up from existing storage', () => {
    it('reads existing tokens from storage at construction time', async () => {
      // Pre-populate storage as if a previous session left tokens behind
      storage.set('access_token', 'pre-existing-access');
      storage.set('refresh_token', 'pre-existing-refresh');

      const tm2 = new TokenManager({ storage, accessTokenType: 'header' });
      await tm2.ready();

      // Sync read works without further async calls
      expect(tm2.getAccessTokenSync()).toBe('pre-existing-access');
      expect(tm2.getRefreshTokenSync()).toBe('pre-existing-refresh');
    });

    it('async storage: ready() resolves once mirror is populated', async () => {
      const asyncStore = new AsyncMemoryStorage();
      await asyncStore.set('access_token', 'async-access');
      await asyncStore.set('refresh_token', 'async-refresh');

      const tm3 = new TokenManager({ storage: asyncStore, accessTokenType: 'header' });

      // BEFORE ready(): mirror is null
      expect(tm3.getAccessTokenSync()).toBeNull();

      // AFTER ready(): mirror is populated
      await tm3.ready();
      expect(tm3.getAccessTokenSync()).toBe('async-access');
      expect(tm3.getRefreshTokenSync()).toBe('async-refresh');
    });
  });

  describe('cookie mode bypasses mirror', () => {
    it('getAccessTokenSync always returns null in cookie mode', () => {
      const cookieTm = new TokenManager({ storage: new MemoryStorage(), accessTokenType: 'cookie' });
      expect(cookieTm.getAccessTokenSync()).toBeNull();
      expect(cookieTm.getAuthorizationHeaderSync()).toBeNull();
    });

    it('setTokens is a no-op in cookie mode (mirror stays null)', async () => {
      const cookieTm = new TokenManager({ storage: new MemoryStorage(), accessTokenType: 'cookie' });
      await cookieTm.setTokens({ accessToken: 'leaked?', refreshToken: 'also-leaked?' });
      expect(cookieTm.getAccessTokenSync()).toBeNull();
    });

    it('switching from header → cookie clears the access/refresh mirror', async () => {
      await tm.setTokens({ accessToken: 'a', refreshToken: 'r' });
      expect(tm.getAccessTokenSync()).toBe('a');

      tm.setMode('cookie');
      expect(tm.getAccessTokenSync()).toBeNull();
      expect(tm.getRefreshTokenSync()).toBeNull();
    });

    it('switching cookie → header re-warms from storage', async () => {
      // Start in header mode, set tokens (populates storage)
      await tm.setTokens({ accessToken: 'persisted', refreshToken: 'persisted-r' });

      // Flip to cookie, mirror clears, but storage retains
      tm.setMode('cookie');
      expect(tm.getAccessTokenSync()).toBeNull();
      expect(storage.get('access_token')).toBe('persisted');

      // Flip back — warm-up should re-populate mirror
      tm.setMode('header');
      await tm.ready();
      expect(tm.getAccessTokenSync()).toBe('persisted');
    });
  });

  describe('storage-fallback path (mirror miss)', () => {
    it('async getAccessToken hits storage when mirror is empty and warms mirror', async () => {
      // Bypass the normal setTokens path: drop a token directly into storage
      storage.set('access_token', 'storage-only-token');

      // Mirror is empty (we didn't go through setTokens)
      expect(tm.getAccessTokenSync()).toBeNull();

      // Async read hits storage AND warms the mirror
      const v = await tm.getAccessToken();
      expect(v).toBe('storage-only-token');

      // Mirror now populated → subsequent sync reads work
      expect(tm.getAccessTokenSync()).toBe('storage-only-token');
    });

    it('async getRefreshToken: same fallback + warm behaviour', async () => {
      storage.set('refresh_token', 'r-fallback');
      expect(tm.getRefreshTokenSync()).toBeNull();
      expect(await tm.getRefreshToken()).toBe('r-fallback');
      expect(tm.getRefreshTokenSync()).toBe('r-fallback');
    });
  });

  describe('trust token mirror', () => {
    it('setTrustToken populates mirror for sync read', async () => {
      await tm.setTrustToken('trust-abc');
      expect(tm.getTrustTokenSync()).toBe('trust-abc');
    });

    it('clearTrustToken clears mirror + storage', async () => {
      await tm.setTrustToken('t');
      await tm.clearTrustToken();
      expect(tm.getTrustTokenSync()).toBeNull();
      expect(storage.get('trust_token')).toBeNull();
    });

    it('clearTokens does NOT clear the trust token (intentional)', async () => {
      await tm.setTokens({ accessToken: 'a', refreshToken: 'r' });
      await tm.setTrustToken('keep-me');
      await tm.clearTokens();

      expect(tm.getAccessTokenSync()).toBeNull();
      expect(tm.getTrustTokenSync()).toBe('keep-me'); // survives clearTokens
    });
  });
});

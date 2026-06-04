/**
 * Real tests for AuthClient.getTokenState / subscribeTokenState (T-167d).
 *
 * NO MOCKS. Uses real AuthClient + real MemoryStorage. The event emitter is
 * the production EventEmitter (also real, no mock).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuthClient } from '../../src/client/auth-client';
import { MemoryStorage } from '../../src/storage/memory.storage';
import { makeValidJwt, makeJwtExpiringIn, now } from '../fixtures/jwt.fixtures';
import type { TokenState } from '../../src/types/auth.types';

function newClient(opts?: any): AuthClient {
  return new AuthClient({
    baseUrl: 'http://test.local',
    accessTokenType: 'header',
    storage: new MemoryStorage(),
    autoRefresh: false,
    ...opts,
  });
}

describe('AuthClient.getTokenState — T-167d', () => {
  let client: AuthClient;

  beforeEach(async () => {
    client = newClient();
    await client.ready();
  });

  it('returns null token + unauthenticated when no login', () => {
    const state = client.getTokenState();
    expect(state.accessToken).toBeNull();
    expect(state.userId).toBeNull();
    expect(state.expiresAt).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.mode).toBe('header');
  });

  it('returns full state after setTokens', async () => {
    const expectedExpSec = now() + 3600;
    const token = makeJwtExpiringIn(3600, { sub: 'u-state', userId: 'u-state' });
    await (client as any).tokenManager.setTokens({ accessToken: token, refreshToken: 'r' });

    const state = client.getTokenState();
    expect(state.accessToken).toBe(token);
    expect(state.userId).toBe('u-state');
    expect(state.mode).toBe('header');
    expect(state.expiresAt).toBeInstanceOf(Date);
    // Within 1s of expected (clock skew tolerance)
    expect(Math.abs(state.expiresAt!.getTime() / 1000 - expectedExpSec)).toBeLessThanOrEqual(1);
  });

  it('cookie mode: accessToken is null but mode reflects', async () => {
    const cookieClient = newClient({ accessTokenType: 'cookie' });
    await cookieClient.ready();
    const state = cookieClient.getTokenState();
    expect(state.accessToken).toBeNull();
    expect(state.mode).toBe('cookie');
  });
});

describe('AuthClient.subscribeTokenState — T-167d', () => {
  let client: AuthClient;

  beforeEach(async () => {
    client = newClient();
    await client.ready();
  });

  it('fires listener on tokensSet event', async () => {
    const updates: TokenState[] = [];
    const unsub = client.subscribeTokenState((s) => updates.push(s));

    const token = makeValidJwt({ sub: 'u-1' });
    // emit tokensSet via the internal events object — same as login() would
    await (client as any).events.emitAsync('tokensSet', {
      accessToken: token,
      refreshToken: 'r',
    });

    // The listener fires; state reflects whatever tokenManager has at that moment.
    expect(updates.length).toBe(1);
    expect(updates[0].mode).toBe('header');
    unsub();
  });

  it('fires listener on tokensRemoved', async () => {
    const updates: TokenState[] = [];
    const unsub = client.subscribeTokenState((s) => updates.push(s));

    await (client as any).events.emitAsync('tokensRemoved', undefined);
    expect(updates.length).toBe(1);
    expect(updates[0].accessToken).toBeNull();
    unsub();
  });

  it('fires listener on tokenRefreshed', async () => {
    const updates: TokenState[] = [];
    const unsub = client.subscribeTokenState((s) => updates.push(s));

    await (client as any).events.emitAsync('tokenRefreshed', { accessToken: 'new', refreshToken: 'r' });
    expect(updates.length).toBe(1);
    unsub();
  });

  it('unsubscribe stops further notifications', async () => {
    const updates: TokenState[] = [];
    const unsub = client.subscribeTokenState((s) => updates.push(s));

    await (client as any).events.emitAsync('tokensSet', { accessToken: 't1', refreshToken: 'r' });
    expect(updates.length).toBe(1);

    unsub();

    await (client as any).events.emitAsync('tokensSet', { accessToken: 't2', refreshToken: 'r' });
    expect(updates.length).toBe(1); // no new notification after unsubscribe
  });

  it('multiple subscribers all receive notifications', async () => {
    const a: TokenState[] = [];
    const b: TokenState[] = [];
    const unsubA = client.subscribeTokenState((s) => a.push(s));
    const unsubB = client.subscribeTokenState((s) => b.push(s));

    await (client as any).events.emitAsync('tokensSet', { accessToken: 't', refreshToken: 'r' });

    expect(a.length).toBe(1);
    expect(b.length).toBe(1);
    unsubA();
    unsubB();
  });
});

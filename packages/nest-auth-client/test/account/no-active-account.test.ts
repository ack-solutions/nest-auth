/**
 * Regression: AccountManager auth resolution with NO active account.
 *
 * Before: getAuthHeaders()/getAuthHeadersSync()/shouldSendCookies()/refresh()
 * silently returned {} / false / null, so every request through an attached axios
 * went out ANONYMOUS and 401'd — while an AuthProvider fed a bootstrap client still
 * showed the user signed in. Two token sources diverging silently.
 *
 * After: resolveActiveClient() falls back to a configured fallbackClient, and when
 * nothing resolves the onNoActiveAccount hook fires instead of failing silently.
 */
import { describe, it, expect } from 'vitest';
import { AccountManager, AuthClient, MemoryStorage } from '../../src';
import type { StorageAdapter } from '../../src';
import { FakeAxios } from '../fixtures/fake-axios';
import { makeValidJwt } from '../fixtures/jwt.fixtures';

const BASE = 'nest_auth_';
const BASE_URL = 'http://test.local';

function sharedFactory() {
  const store = new Map<string, string>();
  const factory = (ns: string): StorageAdapter => ({
    get: (k) => store.get(ns + k) ?? null,
    set: (k, v) => void store.set(ns + k, v),
    remove: (k) => void store.delete(ns + k),
    clear: () => {
      for (const key of [...store.keys()]) if (key.startsWith(ns)) store.delete(key);
    },
    keys: () => [...store.keys()].filter((key) => key.startsWith(ns)).map((key) => key.slice(ns.length)),
  });
  return { store, factory };
}

const newManager = (factory: (ns: string) => StorageAdapter, extra?: any) =>
  new AccountManager({ baseUrl: BASE_URL, accessTokenType: 'header', storageFactory: factory, autoRefresh: false, ...extra });

/** A standalone "bootstrap" client holding a token. */
async function bootstrapClient(token: string): Promise<AuthClient> {
  const c = new AuthClient({ baseUrl: BASE_URL, accessTokenType: 'header', storage: new MemoryStorage(), autoRefresh: false });
  await c.ready();
  await (c as any).tokenManager.setTokens({ accessToken: token, refreshToken: 'r-boot' });
  return c;
}

describe('AccountManager — no active account', () => {
  it('fires onNoActiveAccount instead of silently returning {}', async () => {
    const { factory } = sharedFactory();
    const seen: string[] = [];
    const m = newManager(factory, { onNoActiveAccount: (i: any) => seen.push(i.method) });
    await m.ready();

    expect(await m.getAuthHeaders()).toEqual({}); // still non-fatal (public requests work)
    expect(m.getAuthHeadersSync()).toEqual({});
    expect(m.shouldSendCookies()).toBe(false);
    expect(await m.refresh()).toBeNull();

    // ...but it is no longer SILENT
    expect(seen).toEqual(['getAuthHeaders', 'getAuthHeadersSync', 'shouldSendCookies', 'refresh']);
  });

  it('falls back to the configured fallbackClient (request is NOT anonymous)', async () => {
    const { factory } = sharedFactory();
    const token = makeValidJwt({ sub: 'boot' });
    const fallbackClient = await bootstrapClient(token);
    const seen: string[] = [];
    const m = newManager(factory, { fallbackClient, onNoActiveAccount: (i: any) => seen.push(i.method) });
    await m.ready();

    expect(m.resolveActiveClient()).toBe(fallbackClient);
    expect((await m.getAuthHeaders()).Authorization).toBe(`Bearer ${token}`);
    expect(seen).toEqual([]); // resolved → hook must NOT fire
  });

  it('an active account still wins over the fallback', async () => {
    const { store, factory } = sharedFactory();
    const ns = `${BASE}a_valid_`;
    store.set(`${BASE}accounts_index`, JSON.stringify({ accounts: [{ accountId: 'u1', ns }], activeAccountId: 'u1' }));

    const fallbackToken = makeValidJwt({ sub: 'boot' });
    const m = newManager(factory, { fallbackClient: await bootstrapClient(fallbackToken) });
    await m.ready();

    const activeToken = makeValidJwt({ sub: 'u1' });
    await (m.getActiveClient() as any).tokenManager.setTokens({ accessToken: activeToken, refreshToken: 'r-1' });

    expect(m.resolveActiveClient()).toBe(m.getActiveClient());
    expect((await m.getAuthHeaders()).Authorization).toBe(`Bearer ${activeToken}`);
  });

  it('before ready(), a persisted active account wins — never the fallback (wrong identity)', async () => {
    const { store, factory } = sharedFactory();
    const ns = `${BASE}a_valid_`;
    store.set(`${BASE}accounts_index`, JSON.stringify({ accounts: [{ accountId: 'u1', ns }], activeAccountId: 'u1' }));
    // seed the persisted account's token so it can answer
    const activeToken = makeValidJwt({ sub: 'u1' });
    store.set(`${ns}access_token`, activeToken);

    const seen: string[] = [];
    const fallbackToken = makeValidJwt({ sub: 'boot' });
    // NOTE: no `await ready()` — resolve during the index-load window
    const m = newManager(factory, {
      fallbackClient: await bootstrapClient(fallbackToken),
      onNoActiveAccount: (i: any) => seen.push(i.method),
    });

    const headers = await m.getAuthHeaders(); // awaits ready() internally
    expect(headers.Authorization).toBe(`Bearer ${activeToken}`); // NOT the bootstrap token
    expect(seen).toEqual([]); // and no spurious "no active account" signal
  });

  it('sync resolvers return the safe default (not the fallback) until the index has loaded', async () => {
    const { store, factory } = sharedFactory();
    store.set(
      `${BASE}accounts_index`,
      JSON.stringify({ accounts: [{ accountId: 'u1', ns: `${BASE}a_valid_` }], activeAccountId: 'u1' }),
    );
    const seen: string[] = [];
    const m = newManager(factory, {
      fallbackClient: await bootstrapClient(makeValidJwt({ sub: 'boot' })),
      onNoActiveAccount: (i: any) => seen.push(i.method),
    });

    // pre-ready: must NOT answer as the fallback, and must not fire the hook
    expect(m.getAuthHeadersSync()).toEqual({});
    expect(m.shouldSendCookies()).toBe(false);
    expect(seen).toEqual([]);

    await m.ready();
    expect(m.getActiveAccountId()).toBe('u1'); // the persisted account was there all along
  });

  it('an attached axios sends the fallback token when no account is active', async () => {
    const { factory } = sharedFactory();
    const token = makeValidJwt({ sub: 'boot' });
    const m = newManager(factory, { fallbackClient: await bootstrapClient(token) });
    await m.ready();

    let seenAuth: string | undefined;
    const axios = new FakeAxios(async (config) => {
      seenAuth = config.headers?.Authorization;
      return { status: 200, data: {}, headers: {} };
    });
    m.attachToAxios(axios);

    await axios.request({ url: `${BASE_URL}/api/data`, method: 'get' });
    expect(seenAuth).toBe(`Bearer ${token}`); // was: undefined → anonymous 401
  });
});

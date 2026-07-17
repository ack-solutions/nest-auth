/**
 * AccountManager orphaned-namespace GC + reset() + discardPendingClient().
 *
 * Uses a REAL shared-store factory that mirrors localStorage semantics (one
 * backing Map; namespaced adapters prefix + can enumerate via keys()). No
 * backend — a stub httpAdapter answers the best-effort logout calls.
 */
import { describe, it, expect } from 'vitest';
import { AccountManager } from '../../src';
import type { StorageAdapter } from '../../src';

const BASE = 'nest_auth_'; // default storageNamespace

/** localStorage-like: one shared store, each ns is a key prefix, keys() enumerates. */
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

const stubAdapter = { request: async () => ({ status: 200, ok: true, data: {}, headers: {} }) } as any;
const newManager = (factory: (ns: string) => StorageAdapter, extra?: any) =>
  new AccountManager({ baseUrl: 'http://x', accessTokenType: 'header', storageFactory: factory, httpAdapter: stubAdapter, ...extra });

const hasNs = (store: Map<string, string>, ns: string) => [...store.keys()].some((k) => k.startsWith(ns));
const anyAccountNs = (store: Map<string, string>) => [...store.keys()].some((k) => /^nest_auth_a_[^_]+_/.test(k));

function seedAccount(store: Map<string, string>, ns: string, accountId: string) {
  store.set(`${ns}access_token`, 'a');
  store.set(`${ns}refresh_token`, 'r');
  store.set(`${ns}session`, '{}');
  return { accountId, ns };
}

describe('AccountManager — orphaned-namespace GC', () => {
  it('reaps orphaned namespaces on ready(), keeps indexed ones', async () => {
    const { store, factory } = sharedFactory();
    const valid = seedAccount(store, `${BASE}a_valid_`, 'u1');
    seedAccount(store, `${BASE}a_orphan_`, 'gone'); // written, but not in the index
    store.set(`${BASE}accounts_index`, JSON.stringify({ accounts: [valid], activeAccountId: 'u1' }));

    const m = newManager(factory);
    await m.ready();

    expect(hasNs(store, `${BASE}a_orphan_`)).toBe(false); // orphan reaped
    expect(hasNs(store, `${BASE}a_valid_`)).toBe(true); // indexed account kept
    expect(m.listAccounts().map((a) => a.accountId)).toEqual(['u1']);
  });

  it('reset() removes all accounts (incl. orphans) and wipes per-account storage', async () => {
    const { store, factory } = sharedFactory();
    const valid = seedAccount(store, `${BASE}a_valid_`, 'u1');
    seedAccount(store, `${BASE}a_orphan_`, 'gone');
    store.set(`${BASE}accounts_index`, JSON.stringify({ accounts: [valid], activeAccountId: 'u1' }));

    const m = newManager(factory);
    await m.ready();
    await m.reset();

    expect(anyAccountNs(store)).toBe(false); // no a_* namespaces left at all
    expect(m.listAccounts()).toEqual([]);
    expect(m.getActiveAccountId()).toBeNull();
  });

  it('discardPendingClient() clears an uncommitted pending namespace', async () => {
    const { store, factory } = sharedFactory();
    const m = newManager(factory);
    await m.ready();

    const pending = m.createPendingClient();
    await (pending as any).tokenManager.setTokens({ accessToken: 'a', refreshToken: 'r' });
    expect(anyAccountNs(store)).toBe(true); // pending login wrote tokens to its ns

    await m.discardPendingClient(pending);
    expect(anyAccountNs(store)).toBe(false); // pending ns cleared — no orphan
  });

  it('reapOrphanStorageOnReady:false leaves un-indexed (pending) namespaces alone', async () => {
    // Cross-tab guard: an app driving un-indexed pending clients across reloads
    // can opt out so a second manager's boot GC does not reap a live pending ns.
    const { store, factory } = sharedFactory();
    const mA = newManager(factory, { reapOrphanStorageOnReady: false });
    await mA.ready();
    const p = mA.createPendingClient();
    await (p as any).tokenManager.setTokens({ accessToken: 'a', refreshToken: 'r' });

    const mB = newManager(factory, { reapOrphanStorageOnReady: false });
    await mB.ready();

    expect(anyAccountNs(store)).toBe(true); // survives when GC-on-ready is disabled
  });

  it('GC is a graceful no-op when the adapter cannot enumerate keys', async () => {
    const store = new Map<string, string>();
    const noKeysFactory = (ns: string): StorageAdapter => ({
      get: (k) => store.get(ns + k) ?? null,
      set: (k, v) => void store.set(ns + k, v),
      remove: (k) => void store.delete(ns + k),
      clear: () => {
        for (const key of [...store.keys()]) if (key.startsWith(ns)) store.delete(key);
      },
      // no keys()
    });
    seedAccount(store, `${BASE}a_orphan_`, 'gone');
    const m = newManager(noKeysFactory);
    await expect(m.ready()).resolves.toBeUndefined(); // no throw
    expect(hasNs(store, `${BASE}a_orphan_`)).toBe(true); // cannot enumerate → not reaped
  });

  it('reset() clears known accounts directly even on an adapter without keys()', async () => {
    const store = new Map<string, string>();
    const noKeysFactory = (ns: string): StorageAdapter => ({
      get: (k) => store.get(ns + k) ?? null,
      set: (k, v) => void store.set(ns + k, v),
      remove: (k) => void store.delete(ns + k),
      clear: () => {
        for (const key of [...store.keys()]) if (key.startsWith(ns)) store.delete(key);
      },
      // no keys() → GC is a no-op; reset must still wipe known accounts
    });
    const valid = seedAccount(store, `${BASE}a_valid_`, 'u1');
    store.set(`${BASE}accounts_index`, JSON.stringify({ accounts: [valid], activeAccountId: 'u1' }));

    const m = newManager(noKeysFactory);
    await m.ready();
    expect(hasNs(store, `${BASE}a_valid_`)).toBe(true); // GC couldn't touch it

    await m.reset();
    expect(hasNs(store, `${BASE}a_valid_`)).toBe(false); // reset cleared it directly
    expect(m.listAccounts()).toEqual([]);
  });

  it('a corrupt (unparseable) index does NOT trigger destructive GC — tokens preserved', async () => {
    const { store, factory } = sharedFactory();
    seedAccount(store, `${BASE}a_valid_`, 'u1');
    store.set(`${BASE}accounts_index`, '{ not valid json'); // present but corrupt

    const m = newManager(factory);
    await m.ready();

    // in-memory index is empty (parse failed) but GC must be skipped so the still-valid tokens survive
    expect(hasNs(store, `${BASE}a_valid_`)).toBe(true);
  });
});

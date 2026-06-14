/**
 * Real, no-mock test for the React account-switcher store (the reactive core
 * behind useAccountSwitcher / useSyncExternalStore).
 *
 * A real nest-auth backend runs in its own process. A real AccountManager logs
 * into two accounts; we assert the store's subscribe/getSnapshot contract:
 * notify-on-change, correct snapshots, and referential stability (so React
 * doesn't re-render when nothing changed). No DOM needed — the store is
 * framework-agnostic; the hook is trivial useSyncExternalStore glue over it.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AccountManager } from '@ackplus/nest-auth-client';
import type { StorageAdapter } from '@ackplus/nest-auth-client';
import { createAccountSwitcherStore } from '../../src/account/account-switcher-store';
import { bootBackend, type BackendHandle } from '../helpers/boot-backend';

const PASSWORD = 'MultiAcct!1';
const EMAIL_A = 'rs-a@test.local';
const EMAIL_B = 'rs-b@test.local';

function memoryStorageFactory(): (ns: string) => StorageAdapter {
    const stores = new Map<string, Map<string, string>>();
    return (ns: string): StorageAdapter => {
        if (!stores.has(ns)) stores.set(ns, new Map());
        const m = stores.get(ns)!;
        return {
            get: (k) => (m.has(k) ? m.get(k)! : null),
            set: (k, v) => void m.set(k, v),
            remove: (k) => void m.delete(k),
            clear: () => m.clear(),
        };
    };
}

const loginDto = (email: string) =>
    ({ providerName: 'email', credentials: { email, password: PASSWORD } }) as any;

describe('account-switcher store — real backend reactivity', () => {
    let backend: BackendHandle;
    let baseUrl: string;

    beforeAll(async () => {
        backend = await bootBackend();
        baseUrl = backend.baseUrl;
        for (const email of [EMAIL_A, EMAIL_B]) {
            await fetch(`${baseUrl}/auth/signup`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ email, password: PASSWORD }),
            });
        }
    }, 60_000);

    afterAll(async () => {
        await backend?.close();
    });

    it('notifies subscribers and exposes correct, referentially-stable snapshots', async () => {
        const manager = new AccountManager({ baseUrl, accessTokenType: 'header', storageFactory: memoryStorageFactory() });
        await manager.ready();
        const store = createAccountSwitcherStore(manager);

        let notifications = 0;
        const unsub = store.subscribe(() => {
            notifications++;
        });

        // Empty to start.
        expect(store.getSnapshot().accounts).toEqual([]);
        expect(store.getSnapshot().activeAccountId).toBeNull();
        // Stable identity when unchanged.
        expect(store.getSnapshot()).toBe(store.getSnapshot());

        const a = await manager.addAccount(loginDto(EMAIL_A));
        expect(notifications).toBeGreaterThan(0);
        let snap = store.getSnapshot();
        expect(snap.accounts.map((x) => x.accountId)).toEqual([a.accountId]);
        expect(snap.activeAccount?.accountId).toBe(a.accountId);

        const b = await manager.addAccount(loginDto(EMAIL_B));
        snap = store.getSnapshot();
        expect(snap.accounts.length).toBe(2);
        expect(snap.activeAccountId).toBe(b.accountId);

        // Snapshot identity stays stable across reads when nothing changed.
        expect(store.getSnapshot()).toBe(store.getSnapshot());

        // Switching produces a NEW snapshot identity (so React re-renders).
        const before = store.getSnapshot();
        await manager.switchAccount(a.accountId);
        const after = store.getSnapshot();
        expect(after).not.toBe(before);
        expect(after.activeAccountId).toBe(a.accountId);
        expect(after.accounts.find((x) => x.accountId === a.accountId)?.isActive).toBe(true);

        unsub();
    });
});

/**
 * Real, no-mock E2E tests for the React Native SDK.
 *
 * The RN AuthClient (header-token mode + an AsyncStorageAdapter backed by a real
 * in-memory key/value store) drives genuine HTTP auth flows against a real
 * nest-auth backend. The only thing "in-memory" is the device storage — which is
 * the actual code path RN uses; the server, DB, tokens, and HTTP are all real.
 */
import { describe, it, expect, inject } from 'vitest';
import {
    createNestAuthClient,
    AsyncStorageAdapter,
    type AsyncStorageLike,
} from '../src';

/** A real async key/value store (mimics AsyncStorage), backed by a Map. */
function makeMemoryAsyncStorage(): AsyncStorageLike & { size(): number } {
    const m = new Map<string, string>();
    return {
        getItem: async (k) => (m.has(k) ? m.get(k)! : null),
        setItem: async (k, v) => {
            m.set(k, v);
        },
        removeItem: async (k) => {
            m.delete(k);
        },
        getAllKeys: async () => Array.from(m.keys()),
        multiRemove: async (keys) => {
            keys.forEach((k) => m.delete(k));
        },
        size: () => m.size,
    };
}

function makeClient(baseUrl: string) {
    const kv = makeMemoryAsyncStorage();
    const client = createNestAuthClient({
        baseUrl,
        storage: new AsyncStorageAdapter(kv),
    });
    return { client, kv };
}

const PASSWORD = 'StrongPassword!1';

describe('RN SDK — real backend auth flows', () => {
    const baseUrl = inject('baseUrl') as string;

    it('signs up, persists tokens to storage, and reports authenticated', async () => {
        const { client, kv } = makeClient(baseUrl);
        const email = 'rn-signup@test.local';

        const res = await client.signup({ email, password: PASSWORD });

        expect(res.accessToken).toBeTruthy();
        expect(res.refreshToken).toBeTruthy();
        expect(client.getIsAuthenticated()).toBe(true);

        // Tokens must be persisted via the AsyncStorage adapter (survives restart).
        expect(kv.size()).toBeGreaterThan(0);
        expect(await client.getAccessToken()).toBeTruthy();
    });

    it('logs in with email credentials and fetches session user data', async () => {
        const { client } = makeClient(baseUrl);
        const email = 'rn-login@test.local';
        await client.signup({ email, password: PASSWORD });

        // Fresh client (simulates an app restart) — log in from scratch.
        const { client: fresh } = makeClient(baseUrl);
        const res = await fresh.login({
            providerName: 'email',
            credentials: { email, password: PASSWORD },
        });
        expect(res.accessToken).toBeTruthy();
        expect(fresh.getIsAuthenticated()).toBe(true);

        const user = await fresh.getSessionUserData();
        expect(user.email).toBe(email);
    });

    it('rejects bad credentials', async () => {
        const { client } = makeClient(baseUrl);
        await expect(
            client.login({
                providerName: 'email',
                credentials: { email: 'nobody@test.local', password: 'wrong' },
            }),
        ).rejects.toBeTruthy();
        expect(client.getIsAuthenticated()).toBe(false);
    });

    it('refreshes the access token', async () => {
        const { client } = makeClient(baseUrl);
        await client.signup({ email: 'rn-refresh@test.local', password: PASSWORD });

        const before = await client.getAccessToken();
        const pair = await client.refresh();

        expect(pair).not.toBeNull();
        expect(pair!.accessToken).toBeTruthy();
        const after = await client.getAccessToken();
        expect(after).toBeTruthy();
        // The refreshed token is stored back through the adapter.
        expect(after).toBe(pair!.accessToken);
        // (Sanity) we still have a 'before' token value.
        expect(before).toBeTruthy();
    });

    it('logs out and clears the persisted session', async () => {
        const { client, kv } = makeClient(baseUrl);
        await client.signup({ email: 'rn-logout@test.local', password: PASSWORD });
        expect(client.getIsAuthenticated()).toBe(true);

        await client.logout();

        expect(client.getIsAuthenticated()).toBe(false);
        expect(await client.getAccessToken()).toBeNull();
        expect(kv.size()).toBe(0);
    });
});

/**
 * Real, no-mock E2E tests for AccountManager (multi-account switcher).
 *
 * A real nest-auth backend runs in its own process (in-memory sqljs DB). The
 * AccountManager drives genuine HTTP login flows for two accounts, holds both
 * token pairs in per-account namespaced (in-memory) storage, and switches the
 * active one purely client-side. The server, DB, tokens, and HTTP are all real.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AccountManager, AuthClient } from '../../src';
import type { StorageAdapter } from '../../src';
import { bootBackend, type BackendHandle } from '../helpers/boot-backend';
import { FakeAxios } from '../fixtures/fake-axios';

const PASSWORD = 'MultiAcct!1';
const EMAIL_A = 'mgr-a@test.local';
const EMAIL_B = 'mgr-b@test.local';

/** A storage factory whose namespaces map to stable, isolated in-memory stores. */
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

describe('AccountManager — real backend multi-account (header mode)', () => {
    let backend: BackendHandle;
    let baseUrl: string;

    beforeAll(async () => {
        backend = await bootBackend();
        baseUrl = backend.baseUrl;
        // Seed two real users.
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

    const newManager = () =>
        new AccountManager({ baseUrl, accessTokenType: 'header', storageFactory: memoryStorageFactory() });

    it('adds two accounts without clobbering; the second login does not disturb the first', async () => {
        const m = newManager();
        const a = await m.addAccount(loginDto(EMAIL_A));
        const b = await m.addAccount(loginDto(EMAIL_B));

        expect(m.listAccounts().map((x) => x.accountId).sort()).toEqual([a.accountId, b.accountId].sort());
        expect(m.getActiveAccountId()).toBe(b.accountId); // last added is active
        expect(m.getActiveClient()!.getIsAuthenticated()).toBe(true);
    });

    it('switchAccount repoints the active account with NO server call, and each bearer authenticates as itself', async () => {
        const m = newManager();
        const a = await m.addAccount(loginDto(EMAIL_A));
        const b = await m.addAccount(loginDto(EMAIL_B));

        await m.switchAccount(a.accountId);
        expect(m.getActiveAccountId()).toBe(a.accountId);
        const headersA = await m.getAuthHeaders();

        await m.switchAccount(b.accountId);
        const headersB = await m.getAuthHeaders();

        expect(headersA.Authorization).toBeTruthy();
        expect(headersB.Authorization).toBeTruthy();
        expect(headersA.Authorization).not.toBe(headersB.Authorization);

        // Each account's bearer resolves to its own identity on the real server.
        const meA = await fetch(`${baseUrl}/auth/user`, { headers: { Authorization: headersA.Authorization } }).then((r) => r.json());
        const meB = await fetch(`${baseUrl}/auth/user`, { headers: { Authorization: headersB.Authorization } }).then((r) => r.json());
        expect(meA.email).toBe(EMAIL_A);
        expect(meB.email).toBe(EMAIL_B);
    });

    it('removeAccount revokes that account server-side and falls back to another active account', async () => {
        const m = newManager();
        const a = await m.addAccount(loginDto(EMAIL_A));
        const b = await m.addAccount(loginDto(EMAIL_B)); // active = b

        const headersB = await m.getAuthHeaders();
        await m.removeAccount(b.accountId);

        expect(m.listAccounts().map((x) => x.accountId)).toEqual([a.accountId]);
        expect(m.getActiveAccountId()).toBe(a.accountId);

        // B's session was revoked on the server (logout) → its old bearer now 401s.
        const meB = await fetch(`${baseUrl}/auth/user`, { headers: { Authorization: headersB.Authorization } });
        expect(meB.status).toBe(401);
    });

    it('re-adding the same account replaces it (dedup by accountId)', async () => {
        const m = newManager();
        await m.addAccount(loginDto(EMAIL_A));
        await m.addAccount(loginDto(EMAIL_A)); // same user again
        expect(m.listAccounts().length).toBe(1);
        expect(m.getActiveClient()!.getIsAuthenticated()).toBe(true);
    });

    it('rejects multi-account in cookie mode (single cookie cannot hold N accounts)', () => {
        const m = new AccountManager({ baseUrl, accessTokenType: 'cookie', storageFactory: memoryStorageFactory() });
        expect(() => m.createPendingClient()).toThrow(/header/i);
    });

    it('getClientConfig() returns the public config (incl. multipleAccounts flag) without auth', async () => {
        const client = new AuthClient({ baseUrl, accessTokenType: 'header' });
        const cfg = await client.getClientConfig();
        // The capability flag a UI uses to decide whether to show an account switcher.
        expect(cfg.multipleAccounts).toBeDefined();
        expect(typeof cfg.multipleAccounts?.enabled).toBe('boolean');
        // Other public config a UI commonly needs is present too.
        expect(cfg.tenants).toBeDefined();
        expect(cfg.registration).toBeDefined();
    });

    // ---- 2.5.x DX additions -------------------------------------------------

    it('attachToAxios on the MANAGER follows the ACTIVE account — no re-attach on switch', async () => {
        const m = newManager();
        const a = await m.addAccount(loginDto(EMAIL_A));
        await m.addAccount(loginDto(EMAIL_B)); // active = b

        const seen: Array<string | undefined> = [];
        const axios = new FakeAxios(async (config) => {
            seen.push(config.headers?.Authorization);
            return { status: 200, config };
        });
        const detach = m.attachToAxios(axios);

        await axios.request({ url: '/api/me' }); // active = b
        await m.switchAccount(a.accountId); // pure client switch, NO re-attach
        await axios.request({ url: '/api/me' }); // active = a

        expect(seen[0]).toBeTruthy();
        expect(seen[1]).toBeTruthy();
        expect(seen[0]).not.toBe(seen[1]); // the shared instance picked up the new bearer

        // Each captured bearer resolves to its own identity on the real server.
        const me0 = await fetch(`${baseUrl}/auth/user`, { headers: { Authorization: seen[0]! } }).then((r) => r.json());
        const me1 = await fetch(`${baseUrl}/auth/user`, { headers: { Authorization: seen[1]! } }).then((r) => r.json());
        expect(me0.email).toBe(EMAIL_B);
        expect(me1.email).toBe(EMAIL_A);
        detach();
    });

    it('addAccount meta + setAccountMeta carry a tenant display name on the snapshot', async () => {
        const m = newManager();
        const a = await m.addAccount(loginDto(EMAIL_A), { meta: { tenantName: 'Green Valley' } });
        expect(a.tenantName).toBe('Green Valley');
        expect(m.listAccounts().find((x) => x.accountId === a.accountId)?.tenantName).toBe('Green Valley');

        const updated = await m.setAccountMeta(a.accountId, { tenantName: 'Sunrise', label: 'Sunrise HQ' });
        expect(updated.tenantName).toBe('Sunrise');
        expect(updated.label).toBe('Sunrise HQ');
        expect(m.listAccounts().find((x) => x.accountId === a.accountId)?.tenantName).toBe('Sunrise');
    });

    it('commitAccount registers a pending client with meta (the MFA-completion building block)', async () => {
        const m = newManager();
        const client = m.createPendingClient();
        await client.login(loginDto(EMAIL_A)); // this user has no MFA → completes immediately
        const snap = await m.commitAccount(client, { tenantName: 'Acme Co' });
        expect(snap.tenantName).toBe('Acme Co');
        expect(m.getActiveAccountId()).toBe(snap.accountId);
        expect(m.getActiveClient()!.getIsAuthenticated()).toBe(true);
    });

    it('re-login WITHOUT meta keeps a previously-set tenantName/label (no silent wipe)', async () => {
        const m = newManager();
        const a = await m.addAccount(loginDto(EMAIL_A), { meta: { tenantName: 'Green Valley', label: 'GV' } });
        expect(a.tenantName).toBe('Green Valley');

        // Re-login the SAME account with NO meta — the prior name must survive.
        const a2 = await m.addAccount(loginDto(EMAIL_A));
        expect(a2.accountId).toBe(a.accountId);
        expect(a2.tenantName).toBe('Green Valley');
        expect(a2.label).toBe('GV');
    });

    it('tenantName persists across a fresh AccountManager over the SAME storage (reload)', async () => {
        const sharedFactory = memoryStorageFactory(); // one shared store set across both managers
        const m1 = new AccountManager({ baseUrl, accessTokenType: 'header', storageFactory: sharedFactory });
        const a = await m1.addAccount(loginDto(EMAIL_A), { meta: { tenantName: 'Sunrise' } });
        expect(a.tenantName).toBe('Sunrise');

        // Simulate a page reload: a brand-new manager reading the SAME persisted index.
        const m2 = new AccountManager({ baseUrl, accessTokenType: 'header', storageFactory: sharedFactory });
        await m2.ready();
        expect(m2.listAccounts().find((x) => x.accountId === a.accountId)?.tenantName).toBe('Sunrise');
    });
});

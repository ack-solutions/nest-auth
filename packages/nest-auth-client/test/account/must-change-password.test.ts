/**
 * Regression: the force-change-password signal must survive the multi-account
 * sign-in path.
 *
 * Before: `AuthService` returns `mustChangePassword: true` on the login response
 * and `AuthClient.login()` exposed it, but `AccountManager.addAccount()` resolved
 * to an `AccountSnapshot` that had no such field and discarded the login
 * response — so any app with `allowMultipleAccounts: true` had no way to learn
 * from the sign-in call that the member was on an admin-issued temporary
 * password. Forced-password-change prompts were dead in multi-account apps.
 *
 * After: the snapshot returned by `addAccount`/`commitAccount` carries
 * `mustChangePassword`. It is deliberately ONE-SHOT — never persisted and never
 * on `listAccounts()` snapshots — so a cached `true` can't outlive the password
 * change and trap the user on the change-password screen.
 *
 * No mocks of the client: a real AccountManager + real AuthClients over a tiny
 * real HttpAdapter that serves /auth/login and /auth/me.
 */
import { describe, it, expect } from 'vitest';
import { AccountManager } from '../../src';
import type { HttpAdapter, StorageAdapter } from '../../src';
import { makeValidJwt } from '../fixtures/jwt.fixtures';

const BASE_URL = 'http://test.local';

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
            keys: () => [...m.keys()],
        };
    };
}

/**
 * A backend that reports `mustChangePassword` on login and/or /auth/me.
 * `meFlag`/`loginFlag` are independent so we can prove each source is honoured
 * (the MFA path has no login response in hand; /auth/me covers it).
 */
function backend(opts: { loginFlag?: boolean; meFlag?: boolean; meFails?: boolean } = {}) {
    const calls: string[] = [];
    const adapter: HttpAdapter = {
        async request(o) {
            calls.push(`${o.method} ${o.url}`);
            if (o.url.endsWith('/auth/login')) {
                return {
                    status: 200,
                    ok: true,
                    headers: {},
                    data: {
                        accessToken: makeValidJwt({ sub: 'u-1' }),
                        refreshToken: 'r-1',
                        ...(opts.loginFlag ? { mustChangePassword: true } : {}),
                    },
                } as any;
            }
            if (o.url.endsWith('/auth/me')) {
                if (opts.meFails) return { status: 500, ok: false, headers: {}, data: {} } as any;
                return {
                    status: 200,
                    ok: true,
                    headers: {},
                    data: {
                        id: 'u-1',
                        email: 'temp@acme.test',
                        ...(opts.meFlag ? { mustChangePassword: true } : {}),
                    },
                } as any;
            }
            return { status: 200, ok: true, headers: {}, data: {} } as any;
        },
    };
    const manager = new AccountManager({
        baseUrl: BASE_URL,
        accessTokenType: 'header',
        storageFactory: memoryStorageFactory(),
        httpAdapter: adapter,
        autoRefresh: false,
    });
    return { manager, calls };
}

const loginDto = { providerName: 'email', credentials: { email: 'temp@acme.test', password: 'Temp!1' } } as any;

describe('AccountManager — mustChangePassword on the sign-in snapshot', () => {
    it('surfaces the flag from addAccount (was: silently discarded)', async () => {
        const { manager } = backend({ loginFlag: true, meFlag: true });
        const snap = await manager.addAccount(loginDto);
        expect(snap.mustChangePassword).toBe(true);
    });

    it('reads it from /auth/me with NO extra round-trip beyond the one already made', async () => {
        // login response omits the flag; /auth/me reports it (the MFA-commit path)
        const { manager, calls } = backend({ loginFlag: false, meFlag: true });
        const snap = await manager.addAccount(loginDto);

        expect(snap.mustChangePassword).toBe(true);
        // commitAccount already fetched /auth/me for the label — assert we didn't add another
        expect(calls.filter((c) => c.endsWith('/auth/me'))).toHaveLength(1);
    });

    it('falls back to the login response when the /auth/me lookup fails', async () => {
        const { manager } = backend({ loginFlag: true, meFails: true });
        const snap = await manager.addAccount(loginDto);
        expect(snap.mustChangePassword).toBe(true);
    });

    it('stays absent for a normal account (no false positives)', async () => {
        const { manager } = backend({ loginFlag: false, meFlag: false });
        const snap = await manager.addAccount(loginDto);
        expect(snap.mustChangePassword).toBeUndefined();
    });

    it('is ONE-SHOT: never persisted, so a stale true cannot trap the user', async () => {
        const { manager } = backend({ loginFlag: true, meFlag: true });
        const signIn = await manager.addAccount(loginDto);
        expect(signIn.mustChangePassword).toBe(true);

        // The switcher list must NOT carry it — otherwise an app redirecting on
        // `account.mustChangePassword` would loop forever after the user changed it.
        const listed = manager.listAccounts().find((a) => a.accountId === signIn.accountId);
        expect(listed).toBeDefined(); // the account itself IS in the switcher…
        expect(listed?.mustChangePassword).toBeUndefined(); // …only the flag is one-shot
    });

    it('is not written into the persisted index (a reload starts clean)', async () => {
        const factory = memoryStorageFactory();
        const seen: string[] = [];
        const adapter: HttpAdapter = {
            async request(o) {
                if (o.url.endsWith('/auth/login')) {
                    return {
                        status: 200,
                        ok: true,
                        headers: {},
                        data: { accessToken: makeValidJwt({ sub: 'u-1' }), refreshToken: 'r-1', mustChangePassword: true },
                    } as any;
                }
                if (o.url.endsWith('/auth/me')) {
                    return { status: 200, ok: true, headers: {}, data: { id: 'u-1', email: 'temp@acme.test', mustChangePassword: true } } as any;
                }
                return { status: 200, ok: true, headers: {}, data: {} } as any;
            },
        };
        const cfg = {
            baseUrl: BASE_URL,
            accessTokenType: 'header' as const,
            storageFactory: factory,
            httpAdapter: adapter,
            autoRefresh: false,
        };
        const first = new AccountManager(cfg);
        await first.addAccount(loginDto);

        // Re-boot a manager over the SAME storage — the flag must not come back.
        const second = new AccountManager(cfg);
        await second.ready();
        for (const a of second.listAccounts()) {
            seen.push(String(a.mustChangePassword));
            expect(a.mustChangePassword).toBeUndefined();
        }
        expect(seen).toEqual(['undefined']); // the account did persist; only the flag didn't
    });
});

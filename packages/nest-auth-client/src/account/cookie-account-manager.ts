/**
 * CookieAccountManager — multi-account switcher for COOKIE mode.
 *
 * In cookie mode the JS never sees the tokens (httpOnly). The server holds one
 * set of per-account cookies (`accessToken_<id>` / `refreshToken_<id>`) plus a
 * non-httpOnly selector cookie naming the active account. So here:
 *   - the account LIST comes from the server (`GET /auth/accounts`);
 *   - SWITCHING just rewrites the selector cookie client-side (no server call);
 *   - ADD logs in (the server appends the new account's cookies + selector);
 *   - REMOVE makes the target active then logs out (server clears it + promotes).
 *
 * Browser-only (needs `document.cookie`). Requires the backend to have
 * `session.allowMultipleAccounts` enabled with `accessTokenType: 'cookie'`.
 */

import { ILoginRequest } from '@ackplus/nest-auth-contracts';
import { AuthClientConfig, DEFAULT_ENDPOINTS } from '../types/config.types';
import { AuthClient } from '../client/auth-client';
import type { AccountSnapshot, IAccountSwitcher } from './account-manager';

/** The non-httpOnly selector cookie the backend reads to pick the active account. */
export const ACTIVE_ACCOUNT_COOKIE_NAME = 'nest_auth_active_account';

export class CookieAccountManager implements IAccountSwitcher {
    private readonly client: AuthClient;
    private readonly baseUrl: string;
    private readonly accountsPath: string;
    private readonly listeners = new Set<() => void>();
    private accounts: AccountSnapshot[] = [];
    private activeAccountId: string | null = null;

    constructor(config: AuthClientConfig) {
        this.client = new AuthClient({ ...config, accessTokenType: 'cookie' });
        this.baseUrl = config.baseUrl.replace(/\/$/, '');
        this.accountsPath = config.endpoints?.accounts ?? DEFAULT_ENDPOINTS.accounts;
    }

    async ready(): Promise<void> {
        await this.refreshAccounts();
        this.notify();
    }

    getActiveClient(): AuthClient {
        return this.client;
    }

    listAccounts(): AccountSnapshot[] {
        return this.accounts;
    }

    getActiveAccountId(): string | null {
        return this.activeAccountId;
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /** Log into a new account; the server appends its cookies and makes it active. */
    async addAccount(dto: ILoginRequest): Promise<AccountSnapshot> {
        await this.client.login(dto);
        await this.refreshAccounts();
        this.notify();
        return this.accounts.find((a) => a.isActive) ?? this.accounts[this.accounts.length - 1];
    }

    /** Switch active account by rewriting the selector cookie (no server call). */
    async switchAccount(accountId: string): Promise<AccountSnapshot> {
        this.setSelectorCookie(accountId);
        this.activeAccountId = accountId;
        this.accounts = this.accounts.map((a) => ({ ...a, isActive: a.accountId === accountId }));
        this.notify();
        const found = this.accounts.find((a) => a.accountId === accountId);
        if (!found) throw new Error(`switchAccount: unknown account '${accountId}'.`);
        return found;
    }

    /** Make the target active, then log it out (server revokes it + promotes another). */
    async removeAccount(accountId: string): Promise<void> {
        this.setSelectorCookie(accountId);
        await this.client.logout();
        await this.refreshAccounts();
        this.notify();
    }

    // ---- internals ----------------------------------------------------------

    private async refreshAccounts(): Promise<void> {
        try {
            const res = await fetch(`${this.baseUrl}${this.accountsPath}`, { credentials: 'include' });
            if (!res.ok) return;
            const data = await res.json();
            this.accounts = (data?.accounts ?? []).map((a: any) => ({
                accountId: a.accountId,
                userId: a.accountId,
                tenantId: a.tenantId,
                email: a.email,
                label: a.email ?? a.phone ?? a.accountId,
                isActive: !!a.isActive,
            }));
            this.activeAccountId = this.accounts.find((a) => a.isActive)?.accountId ?? null;
        } catch {
            /* network/SSR — leave the cached list */
        }
    }

    private setSelectorCookie(accountId: string): void {
        if (typeof document === 'undefined') {
            throw new Error('CookieAccountManager.switchAccount requires a browser (document.cookie).');
        }
        document.cookie = `${ACTIVE_ACCOUNT_COOKIE_NAME}=${encodeURIComponent(accountId)}; path=/; samesite=lax`;
    }

    private notify(): void {
        for (const l of this.listeners) {
            try {
                l();
            } catch {
                /* ignore */
            }
        }
    }
}

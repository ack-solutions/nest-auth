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
import { AuthClientConfig, DEFAULT_ENDPOINTS, GetAuthHeadersOptions } from '../types/config.types';
import { AuthClient } from '../client/auth-client';
import { AccountMfaRequiredError } from './account-manager';
import type { AccountSnapshot, AccountMeta, AddAccountOptions, IAccountSwitcher } from './account-manager';
import {
    attachToAxios,
    attachToFetch,
    type AttachOptions,
    type AxiosLikeInstance,
} from '../client/http-attach';

/** The non-httpOnly selector cookie the backend reads to pick the active account. */
export const ACTIVE_ACCOUNT_COOKIE_NAME = 'nest_auth_active_account';

export class CookieAccountManager implements IAccountSwitcher {
    private readonly client: AuthClient;
    private readonly baseUrl: string;
    private readonly accountsPath: string;
    private readonly listeners = new Set<() => void>();
    private accounts: AccountSnapshot[] = [];
    private activeAccountId: string | null = null;
    /**
     * Client-side display-meta overlay (label / tenantName), merged over the
     * server list. NOTE: in-memory and session-scoped — the backend `/accounts`
     * payload does not carry `tenantName`, and this overlay is not persisted, so
     * cookie-mode `tenantName` is lost on a full page reload. Re-stamp it via
     * `setAccountMeta` after `ready()` if you need it to survive reloads.
     */
    private readonly metaOverlay = new Map<string, AccountMeta>();

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

    // ---- AuthHeaderProvider (delegate to the single cookie client) -----------

    getAuthHeaders(opts?: GetAuthHeadersOptions): Promise<Record<string, string>> {
        return this.client.getAuthHeaders(opts);
    }

    shouldSendCookies(): boolean {
        return this.client.shouldSendCookies();
    }

    refresh(): Promise<unknown> {
        return this.client.refresh();
    }

    attachToAxios(instance: AxiosLikeInstance, opts?: AttachOptions): () => void {
        return attachToAxios(this, instance, opts);
    }

    attachToFetch(baseFetch: typeof globalThis.fetch = globalThis.fetch, opts?: AttachOptions): typeof globalThis.fetch {
        return attachToFetch(this, baseFetch, opts);
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

    /**
     * Log into a new account; the server appends its cookies and makes it active.
     * Throws {@link AccountMfaRequiredError} when the login needs an MFA challenge
     * first — complete it on the carried client (verify2fa) then `commitAccount(client)`
     * (same shape as header mode, so the React `completeMfa` flow works here too).
     */
    async addAccount(dto: ILoginRequest, options?: AddAccountOptions): Promise<AccountSnapshot> {
        const res = await this.client.login(dto);
        if ((res as any)?.isRequiresMfa) {
            throw new AccountMfaRequiredError(
                'Login requires MFA. Complete it on the returned client (verify2fa), then call commitAccount(client).',
                this.client,
                res,
            );
        }
        await this.refreshAccounts();
        const active = this.requireActive();
        if (options?.meta) this.mergeMeta(active.accountId, options.meta);
        this.notify();
        return this.accounts.find((a) => a.accountId === active.accountId) ?? active;
    }

    /**
     * Cookie-mode completion of an MFA add: the pending `client` is the single
     * cookie client (the server set its cookies on verify), so re-read the
     * server list and return the now-active account. The `client` arg is
     * accepted for interface parity but ignored (cookie mode has one client).
     */
    async commitAccount(_client: AuthClient, meta?: AccountMeta): Promise<AccountSnapshot> {
        await this.refreshAccounts();
        const active = this.requireActive();
        if (meta) this.mergeMeta(active.accountId, meta);
        this.notify();
        return this.accounts.find((a) => a.accountId === active.accountId) ?? active;
    }

    /** Update an account's app-supplied display metadata (label / tenantName). */
    async setAccountMeta(accountId: string, meta: AccountMeta): Promise<AccountSnapshot> {
        const snap = this.mergeMeta(accountId, meta);
        if (!snap) throw new Error(`setAccountMeta: unknown account '${accountId}'.`);
        this.notify();
        return snap;
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
                tenantName: a.tenantName,
                isActive: !!a.isActive,
            }));
            this.applyOverlay();
            this.activeAccountId = this.accounts.find((a) => a.isActive)?.accountId ?? null;
        } catch {
            /* network/SSR — leave the cached list */
        }
    }

    /** The active account (or the last one). Throws if the server list came back empty. */
    private requireActive(): AccountSnapshot {
        const active = this.accounts.find((a) => a.isActive) ?? this.accounts[this.accounts.length - 1];
        if (!active) {
            throw new Error(
                'CookieAccountManager: no active account after login — the accounts list could not be loaded (GET /auth/accounts failed?).',
            );
        }
        return active;
    }

    /** Merge app-supplied meta over the server-derived account list (kept across refreshes). */
    private applyOverlay(): void {
        if (this.metaOverlay.size === 0) return;
        this.accounts = this.accounts.map((a) => {
            const m = this.metaOverlay.get(a.accountId);
            if (!m) return a;
            return {
                ...a,
                label: m.label ?? a.label,
                tenantName: m.tenantName ?? a.tenantName,
            };
        });
    }

    /** Record meta in the overlay and re-apply it; returns the updated snapshot (or null). */
    private mergeMeta(accountId: string, meta: AccountMeta): AccountSnapshot | null {
        const prev = this.metaOverlay.get(accountId) ?? {};
        this.metaOverlay.set(accountId, {
            label: meta.label ?? prev.label,
            tenantName: meta.tenantName ?? prev.tenantName,
        });
        this.applyOverlay();
        return this.accounts.find((a) => a.accountId === accountId) ?? null;
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

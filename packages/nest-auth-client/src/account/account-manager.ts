/**
 * AccountManager — multi-account login + active-account switching.
 *
 * The backend is multi-session by design: every login mints an independent
 * session and a self-describing token bound to its own `sessionId`. So
 * "multi-account" is a pure CLIENT concern — hold N token pairs and pick which
 * account's bearer to send. AccountManager implements the Gmail/Slack-style
 * account switcher on top of the existing single-account {@link AuthClient}:
 *
 *   - one `AuthClient` per account, each with its OWN namespaced storage so
 *     tokens never collide (the real blocker for naive multi-account);
 *   - an account registry (index) + an `activeAccountId` pointer;
 *   - `switchAccount()` is a pure client operation (repoint the active pointer);
 *     it does NOT call the server — each account already holds valid tokens.
 *
 * Header/bearer mode only. In `accessTokenType: 'cookie'` mode a single cookie
 * name can hold just one account's tokens, so multi-account is rejected (a
 * per-account cookie-namespacing backend mode is a separate, future option).
 */

import { ILoginRequest, IAuthResponse } from '@ackplus/nest-auth-contracts';
import {
    AuthClientConfig,
    StorageAdapter,
    RequestOptions,
    GetAuthHeadersOptions,
} from '../types/config.types';
import { LocalStorageAdapter } from '../storage/local.storage';
import { AuthClient } from '../client/auth-client';

/** A logged-in account as seen by a switcher UI. */
export interface AccountSnapshot {
    /** Stable logical key: `userId` (or `userId:tenantId` when tenant-scoped). */
    accountId: string;
    userId?: string;
    tenantId?: string;
    email?: string;
    /** Display label (name or email), best-effort. */
    label?: string;
    /** Whether this is the currently-active account. */
    isActive: boolean;
}

interface StoredAccount {
    accountId: string;
    /** This account's private storage namespace (key prefix). */
    ns: string;
    userId?: string;
    tenantId?: string;
    email?: string;
    label?: string;
}

interface AccountsIndex {
    accounts: StoredAccount[];
    activeAccountId: string | null;
}

export interface AccountManagerConfig extends Omit<AuthClientConfig, 'storage'> {
    /**
     * Factory that builds a namespaced storage adapter for the given key prefix.
     * Default: `(ns) => new LocalStorageAdapter(ns)`. Supply your own to use
     * AsyncStorage / SecureStore / etc. in React Native.
     */
    storageFactory?: (namespace: string) => StorageAdapter;
    /** Base key prefix for all account storage. Default `'nest_auth_'`. */
    storageNamespace?: string;
}

/** Thrown by `addAccount()` when the login needs an MFA step before it completes. */
export class AccountMfaRequiredError extends Error {
    constructor(
        message: string,
        /** The pending client — complete MFA on it (verify2fa), then call `commitAccount(client)`. */
        public readonly client: AuthClient,
        public readonly response: IAuthResponse,
    ) {
        super(message);
        this.name = 'AccountMfaRequiredError';
    }
}

export class AccountManager {
    private readonly storageFactory: (ns: string) => StorageAdapter;
    private readonly baseNs: string;
    private readonly indexStorage: StorageAdapter;
    private readonly clients = new Map<string, AuthClient>();
    private readonly nsOf = new WeakMap<AuthClient, string>();
    private readonly listeners = new Set<() => void>();
    private index: AccountsIndex = { accounts: [], activeAccountId: null };
    private readonly loaded: Promise<void>;

    constructor(private readonly config: AccountManagerConfig) {
        this.storageFactory = config.storageFactory ?? ((ns) => new LocalStorageAdapter(ns));
        this.baseNs = config.storageNamespace ?? 'nest_auth_';
        this.indexStorage = this.storageFactory(`${this.baseNs}accounts_`);
        this.loaded = this.loadIndex();
    }

    /** Await initial load of the persisted account index. Safe to call repeatedly. */
    async ready(): Promise<void> {
        await this.loaded;
    }

    // ---- public API ---------------------------------------------------------

    /**
     * Build a fresh, namespaced client that is NOT yet a registered account.
     * Run a login flow on it (e.g. for a custom UI), then `commitAccount(client)`.
     */
    createPendingClient(): AuthClient {
        this.assertHeaderMode();
        return this.buildClient(this.genNamespace());
    }

    /**
     * Log into a NEW account without disturbing the existing ones, then register
     * it and make it active. Throws {@link AccountMfaRequiredError} if the login
     * needs an MFA challenge first.
     */
    async addAccount(dto: ILoginRequest, options?: RequestOptions): Promise<AccountSnapshot> {
        await this.ready();
        const client = this.createPendingClient();
        const res = await client.login(dto, options);
        if ((res as any)?.isRequiresMfa) {
            throw new AccountMfaRequiredError(
                'Login requires MFA. Complete it on the returned client (verify2fa), then call commitAccount(client).',
                client,
                res,
            );
        }
        return this.commitAccount(client);
    }

    /**
     * Register a client that has finished authenticating (after `login`/`verify2fa`)
     * as an account, and make it active. Re-committing the same account replaces it.
     */
    async commitAccount(client: AuthClient): Promise<AccountSnapshot> {
        await this.ready();
        const ns = this.nsOf.get(client);
        if (!ns) throw new Error('commitAccount: client was not created by this AccountManager.');

        const session = client.getSession();
        if (!session?.userId) {
            throw new Error('commitAccount: client is not authenticated (no session).');
        }
        const accountId = session.tenantId ? `${session.userId}:${session.tenantId}` : session.userId;

        // Replace any prior login of the same account (clears its old storage).
        const prior = this.index.accounts.find((a) => a.accountId === accountId);
        if (prior && prior.ns !== ns) {
            await this.removeAccount(accountId);
        }

        // Best-effort label for the switcher UI.
        let email: string | undefined;
        let label: string | undefined;
        try {
            const u = (await client.getSessionUserData()) as any;
            email = u?.email ?? undefined;
            label = u?.name ?? u?.displayName ?? email;
        } catch {
            /* labels are optional; identity still works */
        }

        const entry: StoredAccount = { accountId, ns, userId: session.userId, tenantId: session.tenantId, email, label };
        this.index.accounts = this.index.accounts.filter((a) => a.accountId !== accountId).concat(entry);
        this.clients.set(accountId, client);
        this.index.activeAccountId = accountId;
        await this.persist();
        this.notify();
        return this.snapshotOf(entry);
    }

    /** Repoint the active account. Pure client operation — no server call. */
    async switchAccount(accountId: string): Promise<AccountSnapshot> {
        await this.ready();
        const acct = this.index.accounts.find((a) => a.accountId === accountId);
        if (!acct) throw new Error(`switchAccount: unknown account '${accountId}'.`);
        this.index.activeAccountId = accountId;
        this.getClient(accountId); // ensure the client is instantiated
        await this.persist();
        this.notify();
        return this.snapshotOf(acct);
    }

    /** Remove one account: revoke its session server-side (best-effort), clear its storage. */
    async removeAccount(accountId: string): Promise<void> {
        await this.ready();
        const acct = this.index.accounts.find((a) => a.accountId === accountId);
        if (!acct) return;

        const client = this.getClient(accountId);
        try {
            await client?.logout();
        } catch {
            /* best-effort: still drop locally */
        }
        try {
            await Promise.resolve(this.storageFactory(acct.ns).clear?.());
        } catch {
            /* ignore */
        }

        this.clients.delete(accountId);
        this.index.accounts = this.index.accounts.filter((a) => a.accountId !== accountId);
        if (this.index.activeAccountId === accountId) {
            this.index.activeAccountId = this.index.accounts[0]?.accountId ?? null;
        }
        await this.persist();
        this.notify();
    }

    /** All logged-in accounts (for a switcher UI). */
    listAccounts(): AccountSnapshot[] {
        return this.index.accounts.map((a) => this.snapshotOf(a));
    }

    getActiveAccountId(): string | null {
        return this.index.activeAccountId;
    }

    /** The `AuthClient` for the active account (use it for app API calls), or null. */
    getActiveClient(): AuthClient | null {
        return this.index.activeAccountId ? this.getClient(this.index.activeAccountId) : null;
    }

    /** Auth headers for the ACTIVE account — delegate target for a shared axios/fetch instance. */
    async getAuthHeaders(opts?: GetAuthHeadersOptions): Promise<Record<string, string>> {
        const c = this.getActiveClient();
        return c ? c.getAuthHeaders(opts) : {};
    }

    getAuthHeadersSync(opts?: GetAuthHeadersOptions): Record<string, string> {
        const c = this.getActiveClient();
        return c ? c.getAuthHeadersSync(opts) : {};
    }

    /** Subscribe to account-list / active-account changes (for React/Vue stores). */
    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    // ---- internals ----------------------------------------------------------

    private snapshotOf(a: StoredAccount): AccountSnapshot {
        return {
            accountId: a.accountId,
            userId: a.userId,
            tenantId: a.tenantId,
            email: a.email,
            label: a.label,
            isActive: a.accountId === this.index.activeAccountId,
        };
    }

    private getClient(accountId: string): AuthClient | null {
        const acct = this.index.accounts.find((a) => a.accountId === accountId);
        if (!acct) return null;
        let c = this.clients.get(accountId);
        if (!c) {
            c = this.buildClient(acct.ns);
            this.clients.set(accountId, c);
        }
        return c;
    }

    private buildClient(ns: string): AuthClient {
        const { storageFactory, storageNamespace, ...base } = this.config as AccountManagerConfig & Record<string, unknown>;
        const client = new AuthClient({ ...(base as AuthClientConfig), storage: this.storageFactory(ns) });
        this.nsOf.set(client, ns);
        return client;
    }

    private assertHeaderMode(): void {
        if (this.config.accessTokenType === 'cookie') {
            throw new Error(
                'Multi-account requires header/bearer token mode. In cookie mode a single cookie name holds only one account. Set accessTokenType to "header" (or null), or use native secure storage.',
            );
        }
    }

    private genNamespace(): string {
        const g: any = typeof globalThis !== 'undefined' ? globalThis : {};
        const id =
            g.crypto && typeof g.crypto.randomUUID === 'function'
                ? g.crypto.randomUUID()
                : `${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;
        return `${this.baseNs}a_${id}_`;
    }

    private async loadIndex(): Promise<void> {
        try {
            const raw = await Promise.resolve(this.indexStorage.get('index'));
            if (raw) this.index = JSON.parse(raw);
        } catch {
            /* start empty */
        }
        // Notify any subscribers that attached before the async restore finished
        // (e.g. a React store) so they re-read the now-loaded account list.
        this.notify();
    }

    private async persist(): Promise<void> {
        try {
            await Promise.resolve(this.indexStorage.set('index', JSON.stringify(this.index)));
        } catch {
            /* non-fatal */
        }
    }

    private notify(): void {
        for (const l of this.listeners) {
            try {
                l();
            } catch {
                /* listener errors must not break switching */
            }
        }
    }
}

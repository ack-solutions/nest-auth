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
import {
    attachToAxios,
    attachToFetch,
    type AuthHeaderProvider,
    type AttachOptions,
    type AxiosLikeInstance,
} from '../client/http-attach';

/** A logged-in account as seen by a switcher UI. */
export interface AccountSnapshot {
    /** Stable logical key: `userId` (or `userId:tenantId` when tenant-scoped). */
    accountId: string;
    userId?: string;
    tenantId?: string;
    email?: string;
    /** Display label (name or email), best-effort. */
    label?: string;
    /**
     * Human-readable tenant/property name for the switcher UI, when the caller
     * supplied it (via `addAccount`/`commitAccount` meta or `setAccountMeta`).
     * Lets a switcher show "Green Valley" vs "Sunrise" instead of an identical
     * shared-owner email on every row. The server session does not carry a
     * tenant display name, so this is app-supplied.
     */
    tenantName?: string;
    /** Whether this is the currently-active account. */
    isActive: boolean;
    /**
     * True when this account signed in on an admin-issued temporary password and
     * must set a new one (the server's `mustChangePassword`). Route straight to
     * your change-password screen when you see it.
     *
     * **One-shot, by design.** It is only populated on the snapshot returned by
     * {@link IAccountSwitcher.addAccount} / {@link IAccountSwitcher.commitAccount}
     * — i.e. the sign-in call that observed it. It is deliberately NOT persisted
     * in the account index and never appears on `listAccounts()` snapshots: a
     * cached `true` that outlived the password change would bounce the user back
     * to the change-password screen forever. Re-check it later with
     * `client.getSessionUserData()` (`GET /auth/me`), which is always current.
     *
     * `undefined` means "not observed here", not "false" — the backend
     * `mustChangePassword.enforce` guard remains the actual enforcement, so a
     * missed client-side redirect degrades to a server-side block, never to
     * unrestricted access.
     */
    mustChangePassword?: boolean;
}

/** App-supplied display metadata for an account (not derivable from the session). */
export interface AccountMeta {
    /** Override the display label (otherwise best-effort from the user's name/email). */
    label?: string;
    /** Human-readable tenant/property name for the switcher UI. */
    tenantName?: string;
}

/** Options for `addAccount`: request options plus optional display {@link AccountMeta}. */
export interface AddAccountOptions extends RequestOptions {
    /** Display metadata to stamp on the new account (label / tenantName). */
    meta?: AccountMeta;
}

interface StoredAccount {
    accountId: string;
    /** This account's private storage namespace (key prefix). */
    ns: string;
    userId?: string;
    tenantId?: string;
    email?: string;
    label?: string;
    tenantName?: string;
}

interface AccountsIndex {
    accounts: StoredAccount[];
    activeAccountId: string | null;
}

/**
 * Common surface implemented by both the header-mode {@link AccountManager} and
 * the cookie-mode `CookieAccountManager`, so UIs (e.g. the React
 * AccountSwitcherProvider) can drive either transparently.
 */
export interface IAccountSwitcher extends AuthHeaderProvider {
    ready(): Promise<void>;
    listAccounts(): AccountSnapshot[];
    getActiveAccountId(): string | null;
    getActiveClient(): AuthClient | null;
    /**
     * The client auth actually resolves through (active account, else a configured
     * fallback). Feed this to your auth provider so it can't diverge from what an
     * attached axios/fetch sends.
     */
    resolveActiveClient(): AuthClient | null;
    addAccount(dto: ILoginRequest, options?: AddAccountOptions): Promise<AccountSnapshot>;
    /**
     * Register an already-authenticated pending client (after `login`/`verify2fa`)
     * as an account and make it active — the completion step for the
     * {@link AccountMfaRequiredError} flow.
     */
    commitAccount(client: AuthClient, meta?: AccountMeta): Promise<AccountSnapshot>;
    switchAccount(accountId: string): Promise<AccountSnapshot>;
    removeAccount(accountId: string): Promise<void>;
    /** Remove every account (revoke sessions best-effort) and wipe their storage. */
    reset(): Promise<void>;
    /** Update an account's app-supplied display metadata (label / tenantName). */
    setAccountMeta(accountId: string, meta: AccountMeta): Promise<AccountSnapshot>;
    subscribe(listener: () => void): () => void;
    /** Wire a shared axios instance to follow the ACTIVE account (no re-attach on switch). */
    attachToAxios(instance: AxiosLikeInstance, opts?: AttachOptions): () => void;
    /** Wrap fetch so calls follow the ACTIVE account. */
    attachToFetch(baseFetch?: typeof globalThis.fetch, opts?: AttachOptions): typeof globalThis.fetch;
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
    /**
     * On `ready()`, sweep storage and drop any per-account token namespace that
     * the account index no longer references (orphans left by an interrupted
     * add-account flow or an index/storage desync). Default `true`. Requires the
     * storage adapter to expose `keys()` (the built-in local/session adapters do);
     * a no-op otherwise.
     *
     * Set `false` if multiple managers share one storage and you drive un-indexed
     * pending clients across reloads — but note this **re-opens the boot-time
     * leak**, so you must then reap manually via {@link discardPendingClient} /
     * {@link reset}. All managers over the same storage should use the same value.
     */
    reapOrphanStorageOnReady?: boolean;
    /**
     * Client to fall back to when NO account is active — typically your
     * single-account "bootstrap" client. Without it, a manager with no active
     * account resolves no auth headers, so every request through an attached
     * axios/fetch goes out anonymous and 401s while your `AuthProvider` (fed a
     * bootstrap client) still shows the user signed in — two token sources
     * disagreeing silently.
     *
     * Configure this and feed {@link AccountManager.resolveActiveClient} to your
     * auth provider so both resolve the SAME client.
     *
     * It is NOT a managed account: {@link AccountManager.removeAccount} /
     * {@link AccountManager.reset} never revoke or clear it, so auth keeps
     * resolving through it after a reset. If "reset" should mean *signed out
     * everywhere* for your app, log the fallback client out yourself. Don't pass a
     * manager-created pending client here — its namespace is GC-eligible.
     */
    fallbackClient?: AuthClient;
    /**
     * Called when auth is resolved but there is neither an active account nor a
     * {@link fallbackClient} — i.e. the request is about to go out anonymous.
     * Use it to log/redirect instead of silently 401ing. (Not fatal: the call
     * still returns empty headers so genuinely public requests keep working.)
     */
    onNoActiveAccount?: (info: { method: 'getAuthHeaders' | 'getAuthHeadersSync' | 'shouldSendCookies' | 'refresh' }) => void;
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

export class AccountManager implements IAccountSwitcher {
    private readonly storageFactory: (ns: string) => StorageAdapter;
    private readonly baseNs: string;
    private readonly indexStorage: StorageAdapter;
    private readonly clients = new Map<string, AuthClient>();
    private readonly nsOf = new WeakMap<AuthClient, string>();
    /** Namespaces handed out by createPendingClient() but not yet committed — protected from GC. */
    private readonly pendingNamespaces = new Set<string>();
    private readonly listeners = new Set<() => void>();
    private index: AccountsIndex = { accounts: [], activeAccountId: null };
    /** True once the persisted index has been read — sync resolvers must not answer before this. */
    private indexLoaded = false;
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
        const ns = this.genNamespace();
        this.pendingNamespaces.add(ns);
        return this.buildClient(ns);
    }

    /**
     * Discard a pending client (from {@link createPendingClient} / a caught
     * {@link AccountMfaRequiredError}) that will never be committed — clears the
     * tokens its login wrote so its namespace doesn't leak. Safe to call on any
     * pending client; a no-op once committed.
     */
    async discardPendingClient(client: AuthClient): Promise<void> {
        const ns = this.nsOf.get(client);
        if (!ns || !this.pendingNamespaces.has(ns)) return;
        try {
            await Promise.resolve(client.logout());
        } catch {
            /* best-effort server revoke */
        }
        try {
            await Promise.resolve(this.storageFactory(ns).clear?.());
        } catch {
            /* ignore */
        }
        this.pendingNamespaces.delete(ns);
    }

    /**
     * Log into a NEW account without disturbing the existing ones, then register
     * it and make it active. Throws {@link AccountMfaRequiredError} if the login
     * needs an MFA challenge first.
     *
     * The returned snapshot carries {@link AccountSnapshot.mustChangePassword}
     * when the member is on an admin-issued temporary password, so a
     * multi-account app can route to its change-password screen from the
     * sign-in call itself (the single-account `login()` already exposed this).
     */
    async addAccount(dto: ILoginRequest, options?: AddAccountOptions): Promise<AccountSnapshot> {
        await this.ready();
        const { meta, ...reqOpts } = options ?? {};
        const client = this.createPendingClient();
        const res = await client.login(dto, reqOpts);
        if ((res as any)?.isRequiresMfa) {
            throw new AccountMfaRequiredError(
                'Login requires MFA. Complete it on the returned client (verify2fa), then call commitAccount(client).',
                client,
                res,
            );
        }
        const snap = await this.commitAccount(client, meta);
        // `commitAccount` reads the flag from /auth/me; keep the login response as
        // a fallback for when that best-effort lookup failed.
        return (res as any)?.mustChangePassword === true && snap.mustChangePassword !== true
            ? { ...snap, mustChangePassword: true }
            : snap;
    }

    /**
     * Register a client that has finished authenticating (after `login`/`verify2fa`)
     * as an account, and make it active. Re-committing the same account replaces it.
     *
     * The returned snapshot carries {@link AccountSnapshot.mustChangePassword}
     * (read from the `/auth/me` lookup this already performs, so no extra
     * round-trip) — which also covers the MFA path, where the login response
     * that first reported the flag is no longer in hand.
     */
    async commitAccount(client: AuthClient, meta?: AccountMeta): Promise<AccountSnapshot> {
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

        // Best-effort label for the switcher UI. The same payload also carries
        // `mustChangePassword`, so the force-change signal costs no extra call.
        let email: string | undefined;
        let label: string | undefined;
        let mustChangePassword: boolean | undefined;
        try {
            const u = (await client.getSessionUserData()) as any;
            email = u?.email ?? undefined;
            label = u?.name ?? u?.displayName ?? email;
            if (u?.mustChangePassword === true) mustChangePassword = true;
        } catch {
            /* labels are optional; identity still works */
        }

        // Caller-supplied meta wins over the best-effort label and carries the
        // tenant display name the session can't provide. On a re-login (same
        // accountId), fall back to the previously-stamped meta so a meta-less
        // re-login doesn't silently wipe a name set earlier via addAccount/setAccountMeta.
        const entry: StoredAccount = {
            accountId,
            ns,
            userId: session.userId,
            tenantId: session.tenantId,
            email,
            label: meta?.label ?? prior?.label ?? label,
            tenantName: meta?.tenantName ?? prior?.tenantName,
        };
        this.index.accounts = this.index.accounts.filter((a) => a.accountId !== accountId).concat(entry);
        this.clients.set(accountId, client);
        this.pendingNamespaces.delete(ns); // now a committed account, not a pending orphan
        this.index.activeAccountId = accountId;
        await this.persist();
        this.notify();
        // Deliberately merged onto the RETURNED snapshot only — `entry` (and thus
        // the persisted index and every `listAccounts()` snapshot) stays free of
        // it, so the flag can never go stale after the user changes the password.
        const snap = this.snapshotOf(entry);
        return mustChangePassword ? { ...snap, mustChangePassword: true } : snap;
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

    /**
     * Update an account's app-supplied display metadata (label / tenantName).
     * Use it to stamp the property name after the app resolves it post-login.
     * Unknown keys are left unchanged; passing `undefined` for a key keeps it.
     */
    async setAccountMeta(accountId: string, meta: AccountMeta): Promise<AccountSnapshot> {
        await this.ready();
        const acct = this.index.accounts.find((a) => a.accountId === accountId);
        if (!acct) throw new Error(`setAccountMeta: unknown account '${accountId}'.`);
        if (meta.label !== undefined) acct.label = meta.label;
        if (meta.tenantName !== undefined) acct.tenantName = meta.tenantName;
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

    /**
     * Remove every account and wipe all per-account token storage — including
     * orphaned namespaces the index no longer references. Revokes each known
     * account's session server-side (best-effort). Use it to implement a
     * "plain sign-in starts a fresh single-account session" rule without
     * reverse-engineering storage keys.
     *
     * Note: a configured {@link AccountManagerConfig.fallbackClient} is NOT a
     * managed account — it is left untouched, so auth still resolves through it
     * after a reset. Log it out yourself if reset should mean "signed out".
     */
    async reset(): Promise<void> {
        await this.ready();
        const accounts = [...this.index.accounts];
        // Best-effort server revoke for each known account.
        await Promise.allSettled(accounts.map((a) => this.getClient(a.accountId)?.logout()));

        // Clear each known account's + pending client's storage DIRECTLY, so reset
        // wipes local tokens even on a storage adapter that can't enumerate keys().
        for (const ns of [...accounts.map((a) => a.ns), ...this.pendingNamespaces]) {
            try {
                await Promise.resolve(this.storageFactory(ns).clear?.());
            } catch {
                /* ignore */
            }
        }
        this.pendingNamespaces.clear();

        // Empty the index, then GC reaps any remaining orphaned namespaces
        // (keys()-capable adapters); nothing known → nothing spared.
        this.index = { accounts: [], activeAccountId: null };
        this.clients.clear();
        await this.gcOrphans();
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

    /**
     * The client every auth resolution goes through: the ACTIVE account's client,
     * else the configured {@link AccountManagerConfig.fallbackClient}, else null.
     *
     * Feed this (not `getActiveClient()`) to your auth provider so the provider and
     * an attached axios/fetch always resolve the SAME client — otherwise a manager
     * with no active account sends anonymous requests while the UI still shows the
     * user signed in.
     */
    resolveActiveClient(): AuthClient | null {
        return this.getActiveClient() ?? this.config.fallbackClient ?? null;
    }

    /** Auth headers for the resolved account — delegate target for a shared axios/fetch instance. */
    async getAuthHeaders(opts?: GetAuthHeadersOptions): Promise<Record<string, string>> {
        // Wait for the persisted index: resolving before it loads would hand back
        // the fallback for an account that IS active — i.e. send the wrong identity.
        await this.ready();
        const c = this.resolveActiveClient();
        if (!c) {
            this.reportNoActiveAccount('getAuthHeaders');
            return {};
        }
        return c.getAuthHeaders(opts);
    }

    getAuthHeadersSync(opts?: GetAuthHeadersOptions): Record<string, string> {
        // Sync path can't await the index — until it's loaded, fall back to the
        // pre-2.7.3 safe default rather than answering as the wrong account.
        if (!this.indexLoaded) return {};
        const c = this.resolveActiveClient();
        if (!c) {
            this.reportNoActiveAccount('getAuthHeadersSync');
            return {};
        }
        return c.getAuthHeadersSync(opts);
    }

    /** Whether the resolved account's transport sends cookies (delegate for the attach helpers). */
    shouldSendCookies(): boolean {
        if (!this.indexLoaded) return false;
        const c = this.resolveActiveClient();
        if (!c) {
            this.reportNoActiveAccount('shouldSendCookies');
            return false;
        }
        return c.shouldSendCookies();
    }

    /** Refresh the resolved account's tokens (delegate for the attach helpers' 401 retry). */
    async refresh(): Promise<unknown> {
        await this.ready();
        const c = this.resolveActiveClient();
        if (!c) {
            this.reportNoActiveAccount('refresh');
            return null;
        }
        return c.refresh();
    }

    /**
     * Wire a shared axios instance to follow the ACTIVE account. Because headers
     * are read from the active client on every request, switching accounts needs
     * NO re-attach — the same instance just starts sending the new bearer.
     */
    attachToAxios(instance: AxiosLikeInstance, opts?: AttachOptions): () => void {
        return attachToAxios(this, instance, opts);
    }

    /** Wrap fetch so calls follow the ACTIVE account (see {@link attachToAxios}). */
    attachToFetch(baseFetch: typeof globalThis.fetch = globalThis.fetch, opts?: AttachOptions): typeof globalThis.fetch {
        return attachToFetch(this, baseFetch, opts);
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
            tenantName: a.tenantName,
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
        // Strip the manager-only options so they never leak into AuthClientConfig.
        const {
            storageFactory,
            storageNamespace,
            reapOrphanStorageOnReady,
            fallbackClient,
            onNoActiveAccount,
            ...base
        } = this.config as AccountManagerConfig & Record<string, unknown>;
        const client = new AuthClient({ ...(base as AuthClientConfig), storage: this.storageFactory(ns) });
        this.nsOf.set(client, ns);
        return client;
    }

    /** Surface "about to send an anonymous request" instead of failing silently. */
    private reportNoActiveAccount(method: 'getAuthHeaders' | 'getAuthHeadersSync' | 'shouldSendCookies' | 'refresh'): void {
        try {
            this.config.onNoActiveAccount?.({ method });
        } catch {
            /* a reporting hook must never break the request path */
        }
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
        let indexTrusted = true;
        try {
            const raw = await Promise.resolve(this.indexStorage.get('index'));
            if (raw) this.index = JSON.parse(raw);
        } catch {
            // Index present but unparseable (or a storage read error): treat it as
            // untrusted and do NOT reap — a transient/corrupt index must never
            // delete still-valid token sets. (An ABSENT index is trusted-empty and
            // still self-heals genuine orphans below.)
            indexTrusted = false;
        }
        // The index is now known (empty or restored) — sync resolvers may answer.
        this.indexLoaded = true;
        // Reap orphaned per-account namespaces left by an interrupted add-account
        // flow or an index/storage desync (best-effort; needs adapter.keys()).
        if (indexTrusted && this.config.reapOrphanStorageOnReady !== false) {
            await this.gcOrphans();
        }
        // Notify any subscribers that attached before the async restore finished
        // (e.g. a React store) so they re-read the now-loaded account list.
        this.notify();
    }

    /**
     * Drop every `<baseNs>a_<id>_*` token namespace present in storage that the
     * account index no longer references (and that isn't a live pending client).
     * Best-effort: needs the root storage adapter to expose `keys()`; otherwise a
     * no-op. This is what makes the leak self-healing — orphans left by a prior
     * session (abandoned pending client, lost index) are cleared on next boot.
     */
    private async gcOrphans(): Promise<void> {
        // An empty base prefix would enumerate (and could clear) unrelated app keys.
        if (!this.baseNs) return;
        const root = this.storageFactory(this.baseNs);
        if (typeof root.keys !== 'function') return;
        let keys: string[];
        try {
            keys = await Promise.resolve(root.keys());
        } catch {
            return;
        }
        // Namespaces are `a_<id>_` where <id> (a UUID or base36) has no underscore.
        const nsFragment = /^(a_[^_]+_)/;
        const present = new Set<string>();
        for (const k of keys) {
            const m = nsFragment.exec(k);
            if (m) present.add(this.baseNs + m[1]);
        }
        const known = new Set(this.index.accounts.map((a) => a.ns));
        for (const ns of present) {
            if (known.has(ns) || this.pendingNamespaces.has(ns)) continue;
            try {
                await Promise.resolve(this.storageFactory(ns).clear?.());
            } catch {
                /* ignore */
            }
        }
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

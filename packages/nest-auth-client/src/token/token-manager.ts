/**
 * Token manager for handling access/refresh tokens
 * Supports both header and cookie modes
 */

import { ITokenPair as TokenPair } from '@ackplus/nest-auth-contracts';
import { AccessTokenType, Logger } from '../types/config.types';
import { StorageAdapter } from '../types/config.types';
import { isTokenExpired } from './jwt-utils';

/** Storage keys */
const STORAGE_KEYS = {
    ACCESS_TOKEN: 'access_token',
    REFRESH_TOKEN: 'refresh_token',
    EXPIRES_AT: 'expires_at',
    TRUST_TOKEN: 'trust_token',
};

/**
 * Token manager configuration
 */
export interface TokenManagerConfig {
    /** Storage adapter for persisting tokens */
    storage: StorageAdapter;
    /** Initial token mode */
    accessTokenType: AccessTokenType;
    /** Time in seconds before expiry to consider token "expired" */
    refreshThreshold?: number;
    /** Logger for debugging */
    logger?: Logger;
}

/**
 * Token manager for handling authentication tokens
 * 
 * Supports two modes:
 * - 'header': Tokens stored in storage, sent via Authorization header
 * - 'cookie': Tokens managed by server via httpOnly cookies
 */
export class TokenManager {
    private storage: StorageAdapter;
    private mode: AccessTokenType;
    private refreshThreshold: number;
    private logger?: Logger;

    /**
     * In-memory mirror of the current tokens.
     *
     * Storage is the durable source of truth; the mirror is the fast read path.
     * Every `setTokens`/`clearTokens`/`setTrustToken`/`clearTrustToken` writes
     * BOTH the mirror and storage atomically.
     *
     * Rationale (T-167a): consumer-app HTTP clients (axios interceptors, fetch
     * wrappers, SSR helpers) often need the token SYNCHRONOUSLY at request
     * decoration time. Going through async storage on every request is too slow
     * and forces interceptors to be async, which breaks some integration patterns.
     *
     * Tradeoff: if two AuthClient instances share storage and one writes
     * externally, the other instance's mirror won't notice until next async read.
     * This is intentional — same-process auth state is the supported case.
     */
    private accessTokenMirror: string | null = null;
    private refreshTokenMirror: string | null = null;
    private trustTokenMirror: string | null = null;

    /** Resolves once the initial async warm-up from storage completes. */
    private warmupPromise: Promise<void>;

    constructor(config: TokenManagerConfig) {
        this.storage = config.storage;
        this.mode = config.accessTokenType;
        this.refreshThreshold = config.refreshThreshold ?? 60;
        this.logger = config.logger;
        // Kick off warm-up but don't block constructor.
        // Async storage adapters (e.g. AsyncStorage on RN) populate the mirror
        // on first event-loop tick after construction.
        this.warmupPromise = this.warmupMirror();
    }

    /**
     * Populate the in-memory mirror from storage at construction time.
     * Idempotent; safe to call again after `setMode` if behaviour changes.
     */
    private async warmupMirror(): Promise<void> {
        if (this.isCookieMode()) {
            return; // Cookie mode: tokens never leave the browser, mirror stays null.
        }
        try {
            const [access, refresh, trust] = await Promise.all([
                Promise.resolve(this.storage.get(STORAGE_KEYS.ACCESS_TOKEN)),
                Promise.resolve(this.storage.get(STORAGE_KEYS.REFRESH_TOKEN)),
                Promise.resolve(this.storage.get(STORAGE_KEYS.TRUST_TOKEN)),
            ]);
            this.accessTokenMirror = access ?? null;
            this.refreshTokenMirror = refresh ?? null;
            this.trustTokenMirror = trust ?? null;
            this.log('debug', 'warmupMirror: Mirror populated from storage', {
                hasAccess: !!access,
                hasRefresh: !!refresh,
                hasTrust: !!trust,
            });
        } catch (e) {
            // Best-effort warm-up. If storage throws, mirror stays empty until
            // setTokens/setTrustToken is called.
            this.log('warn', 'warmupMirror: storage threw during warm-up', e);
        }
    }

    /**
     * Wait for the initial mirror warm-up to complete. Useful in tests and SSR.
     */
    async ready(): Promise<void> {
        await this.warmupPromise;
    }

    private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
        if (this.logger?.[level]) {
            this.logger[level](`[TokenManager] ${message}`, ...args);
        }
    }

    /**
     * Set the token mode
     */
    setMode(mode: 'header' | 'cookie'): void {
        const prev = this.mode;
        this.mode = mode;
        // Switching INTO cookie mode means we should no longer expose tokens
        // via the mirror — server-managed cookies are the source of truth.
        if (mode === 'cookie' && prev !== 'cookie') {
            this.accessTokenMirror = null;
            this.refreshTokenMirror = null;
            // Trust token mirror stays — it's still relevant in cookie mode.
        }
        // Switching OUT of cookie mode (rare) → re-warm from storage.
        if (mode === 'header' && prev === 'cookie') {
            this.warmupPromise = this.warmupMirror();
        }
    }

    /**
     * Get the current token mode, if null then default to 'header'
     */
    getMode(): 'header' | 'cookie' {
        return this.mode || 'header';
    }

    /**
     * Check if using cookie mode
     */
    isCookieMode(): boolean {
        return this.getMode() === 'cookie';
    }

    /**
     * Check if using header mode
     */
    isHeaderMode(): boolean {
        return this.getMode() === 'header';
    }

    /**
     * Store tokens (only in header mode).
     * Updates mirror + storage atomically (mirror first so sync reads see it immediately).
     */
    async setTokens(tokens: TokenPair): Promise<void> {
        if (this.isCookieMode()) {
            this.log('debug', 'setTokens: Cookie mode - tokens managed by server');
            return;
        }

        this.log('debug', 'setTokens: Storing tokens in header mode', {
            hasAccessToken: !!tokens.accessToken,
            hasRefreshToken: !!tokens.refreshToken,
            accessTokenLength: tokens.accessToken?.length || 0,
        });

        // Mirror first — sync readers see the new token immediately.
        this.accessTokenMirror = tokens.accessToken;
        this.refreshTokenMirror = tokens.refreshToken;

        // Then persist. If storage throws, mirror is still updated (best-effort
        // durability — sync reads work, future async reads fall back to storage).
        await Promise.resolve(this.storage.set(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken));
        await Promise.resolve(this.storage.set(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken));

        this.log('debug', 'setTokens: Tokens stored successfully');
    }

    /**
     * Get the access token (only in header mode).
     * Prefers in-memory mirror (set by `setTokens`); falls back to storage on miss
     * (e.g., another process/tab wrote the token and our warm-up hasn't run yet).
     */
    async getAccessToken(): Promise<string | null> {
        if (this.isCookieMode()) {
            this.log('debug', 'getAccessToken: Cookie mode - returning null');
            return null;
        }

        if (this.accessTokenMirror) {
            return this.accessTokenMirror;
        }

        const token = (await Promise.resolve(this.storage.get(STORAGE_KEYS.ACCESS_TOKEN))) ?? null;
        if (token) {
            this.accessTokenMirror = token; // warm the mirror
            this.log('debug', 'getAccessToken: Token loaded from storage', { length: token.length });
        } else {
            this.log('debug', 'getAccessToken: NOT_FOUND');
        }
        return token;
    }

    /**
     * Sync read of the access token from the in-memory mirror.
     *
     * Returns null if:
     *  - cookie mode (tokens are server-managed)
     *  - mirror not yet warmed up (call `await tokenManager.ready()` to wait)
     *  - no token has been set
     *
     * Use this in request interceptors (axios.interceptors.request, fetch wrappers)
     * where async access would force the entire interceptor to be async.
     * Use `getAccessToken()` for the async path that also consults storage.
     */
    getAccessTokenSync(): string | null {
        if (this.isCookieMode()) return null;
        return this.accessTokenMirror;
    }

    /**
     * Get the refresh token (only in header mode). Mirror-first like getAccessToken.
     */
    async getRefreshToken(): Promise<string | null> {
        if (this.isCookieMode()) {
            return null;
        }
        if (this.refreshTokenMirror) {
            return this.refreshTokenMirror;
        }

        const token = (await Promise.resolve(this.storage.get(STORAGE_KEYS.REFRESH_TOKEN))) ?? null;
        if (token) {
            this.refreshTokenMirror = token;
            this.log('debug', 'getRefreshToken: Token loaded from storage', { length: token.length });
        } else {
            this.log('debug', 'getRefreshToken: NOT_FOUND');
        }
        return token;
    }

    /** Sync counterpart to getRefreshToken. See getAccessTokenSync for caveats. */
    getRefreshTokenSync(): string | null {
        if (this.isCookieMode()) return null;
        return this.refreshTokenMirror;
    }

    /**
     * Get both tokens
     */
    async getTokens(): Promise<TokenPair | null> {
        const accessToken = await this.getAccessToken();
        const refreshToken = await this.getRefreshToken();

        if (!accessToken || !refreshToken) {
            return null;
        }

        return { accessToken, refreshToken };
    }

    /**
     * Get the trust token (for trusted device verification). Mirror-first.
     */
    async getTrustToken(): Promise<string | null> {
        if (this.trustTokenMirror) {
            return this.trustTokenMirror;
        }
        const token = (await Promise.resolve(this.storage.get(STORAGE_KEYS.TRUST_TOKEN))) ?? null;
        if (token) {
            this.trustTokenMirror = token;
            this.log('debug', 'getTrustToken: Trust token loaded from storage');
        } else {
            this.log('debug', 'getTrustToken: No trust token found');
        }
        return token;
    }

    /** Sync read of the trust token. See getAccessTokenSync for caveats. */
    getTrustTokenSync(): string | null {
        return this.trustTokenMirror;
    }

    /**
     * Set the trust token. Mirror first, then storage.
     */
    async setTrustToken(token: string): Promise<void> {
        this.log('debug', 'setTrustToken: Storing trust token');
        this.trustTokenMirror = token;
        await Promise.resolve(this.storage.set(STORAGE_KEYS.TRUST_TOKEN, token));
        this.log('debug', 'setTrustToken: Trust token stored successfully');
    }

    /**
     * Clear the trust token. Mirror first, then storage.
     */
    async clearTrustToken(): Promise<void> {
        this.log('debug', 'clearTrustToken: Clearing trust token');
        this.trustTokenMirror = null;
        await Promise.resolve(this.storage.remove(STORAGE_KEYS.TRUST_TOKEN));
        this.log('debug', 'clearTrustToken: Trust token cleared');
    }

    /**
     * Clear all tokens (access + refresh). Mirror first, then storage.
     * Trust token survives — call `clearTrustToken()` explicitly if you want it gone.
     */
    async clearTokens(): Promise<void> {
        this.log('debug', 'clearTokens: Clearing all tokens');
        this.accessTokenMirror = null;
        this.refreshTokenMirror = null;
        await Promise.resolve(this.storage.remove(STORAGE_KEYS.ACCESS_TOKEN));
        await Promise.resolve(this.storage.remove(STORAGE_KEYS.REFRESH_TOKEN));
        await Promise.resolve(this.storage.remove(STORAGE_KEYS.EXPIRES_AT));
        this.log('debug', 'clearTokens: Tokens cleared');
    }

    /**
     * Check if access token is expired or about to expire
     */
    async isAccessTokenExpired(): Promise<boolean> {
        const token = await this.getAccessToken();
        if (!token) {
            return true;
        }
        const expired = isTokenExpired(token, this.refreshThreshold);
        return expired ?? true;
    }

    /**
     * Check if refresh token is expired
     */
    async isRefreshTokenExpired(): Promise<boolean> {
        const token = await this.getRefreshToken();
        if (!token) {
            return true;
        }
        const expired = isTokenExpired(token);
        return expired ?? true;
    }

    /**
     * Check if we have valid tokens
     */
    async hasValidTokens(): Promise<boolean> {
        if (this.isCookieMode()) {
            // In cookie mode, we can't check tokens client-side
            // We rely on the /me endpoint to verify auth state
            return false;
        }

        const accessExpired = await this.isAccessTokenExpired();
        const refreshExpired = await this.isRefreshTokenExpired();

        // Valid if access token is valid, or if we can refresh
        return !accessExpired || !refreshExpired;
    }

    /**
     * Check if we need to refresh the access token
     */
    async needsRefresh(): Promise<boolean> {
        if (this.isCookieMode()) {
            return false;
        }

        const accessExpired = await this.isAccessTokenExpired();
        const refreshExpired = await this.isRefreshTokenExpired();

        // Need refresh if access token expired but refresh token is valid
        return accessExpired && !refreshExpired;
    }

    /**
     * Get authorization header value (for header mode). Async — consults storage on mirror miss.
     */
    async getAuthorizationHeader(): Promise<string | null> {
        if (this.isCookieMode()) {
            this.log('debug', 'getAuthorizationHeader: Cookie mode - returning null');
            return null;
        }

        const token = await this.getAccessToken();
        if (!token) {
            this.log('debug', 'getAuthorizationHeader: NO_TOKEN');
            return null;
        }

        this.log('debug', 'getAuthorizationHeader: Token found, returning Bearer header');
        return `Bearer ${token}`;
    }

    /**
     * Sync version of `getAuthorizationHeader` — reads only the in-memory mirror.
     *
     * Returns null if:
     *  - cookie mode (tokens are server-managed)
     *  - no token in the mirror (warmup pending, or no login yet)
     *
     * Designed for sync HTTP-client request interceptors (axios.interceptors.request
     * is sync-config; this lets the interceptor stay sync without awaiting storage).
     *
     * For SSR or first-request scenarios where the mirror may not be warm yet,
     * call `await tokenManager.ready()` once at app boot, then use this sync API.
     */
    getAuthorizationHeaderSync(): string | null {
        if (this.isCookieMode()) return null;
        return this.accessTokenMirror ? `Bearer ${this.accessTokenMirror}` : null;
    }
}

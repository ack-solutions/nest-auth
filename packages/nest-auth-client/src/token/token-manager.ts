/**
 * Token manager for handling access/refresh tokens
 * Supports both header and cookie modes
 */

import { ITokenPair as TokenPair } from '@libs/auth-types';
import { AccessTokenType, StorageAdapter } from '../types';
import { isTokenExpired } from './jwt-utils';

/** Storage keys */
const STORAGE_KEYS = {
    ACCESS_TOKEN: 'access_token',
    REFRESH_TOKEN: 'refresh_token',
    EXPIRES_AT: 'expires_at',
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

    constructor(config: TokenManagerConfig) {
        this.storage = config.storage;
        this.mode = config.accessTokenType;
        this.refreshThreshold = config.refreshThreshold ?? 60;
    }

    /**
     * Set the token mode
     */
    setMode(mode: 'header' | 'cookie'): void {
        this.mode = mode;
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
     * Store tokens (only in header mode)
     */
    async setTokens(tokens: TokenPair): Promise<void> {
        if (this.isCookieMode()) {
            // In cookie mode, tokens are managed by the server
            return;
        }

        await Promise.resolve(this.storage.set(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken));
        await Promise.resolve(this.storage.set(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken));
    }

    /**
     * Get the access token (only in header mode)
     */
    async getAccessToken(): Promise<string | null> {
        if (this.isCookieMode()) {
            return null;
        }
        const token = this.storage.get(STORAGE_KEYS.ACCESS_TOKEN);
        return Promise.resolve(token);
    }

    /**
     * Get the refresh token (only in header mode)
     */
    async getRefreshToken(): Promise<string | null> {
        if (this.isCookieMode()) {
            return null;
        }
        const token = this.storage.get(STORAGE_KEYS.REFRESH_TOKEN);
        return Promise.resolve(token);
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
     * Clear all tokens
     */
    async clearTokens(): Promise<void> {
        await Promise.resolve(this.storage.remove(STORAGE_KEYS.ACCESS_TOKEN));
        await Promise.resolve(this.storage.remove(STORAGE_KEYS.REFRESH_TOKEN));
        await Promise.resolve(this.storage.remove(STORAGE_KEYS.EXPIRES_AT));
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
     * Get authorization header value (for header mode)
     */
    async getAuthorizationHeader(): Promise<string | null> {
        if (this.isCookieMode()) {
            return null;
        }

        const token = await this.getAccessToken();
        if (!token) {
            return null;
        }

        return `Bearer ${token}`;
    }
}

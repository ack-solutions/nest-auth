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

    constructor(config: TokenManagerConfig) {
        this.storage = config.storage;
        this.mode = config.accessTokenType;
        this.refreshThreshold = config.refreshThreshold ?? 60;
        this.logger = config.logger;
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
            this.log('debug', 'setTokens: Cookie mode - tokens managed by server');
            return;
        }

        this.log('debug', 'setTokens: Storing tokens in header mode', {
            hasAccessToken: !!tokens.accessToken,
            hasRefreshToken: !!tokens.refreshToken,
            accessTokenLength: tokens.accessToken?.length || 0,
        });

        await Promise.resolve(this.storage.set(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken));
        await Promise.resolve(this.storage.set(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken));

        this.log('debug', 'setTokens: Tokens stored successfully');
    }

    /**
     * Get the access token (only in header mode)
     */
    async getAccessToken(): Promise<string | null> {
        if (this.isCookieMode()) {
            this.log('debug', 'getAccessToken: Cookie mode - returning null');
            return null;
        }
        
        const token = await this.storage.get(STORAGE_KEYS.ACCESS_TOKEN);
        // Handle both sync and async storage adapters
        if(token) {
            this.log('debug', 'getAccessToken: Token found', { length: token.length });
        } else {
            this.log('debug', 'getAccessToken: NOT_FOUND', null);
        }
        return token;
    }

    /**
     * Get the refresh token (only in header mode)
     */
    async getRefreshToken(): Promise<string | null> {
        if (this.isCookieMode()) {
            return null;
        }
        const token = await this.storage.get(STORAGE_KEYS.REFRESH_TOKEN);
        // Handle both sync and async storage adapters
        if(token) {
            this.log('debug', 'getRefreshToken: Token found', { length: token.length });
        } else {
            this.log('debug', 'getRefreshToken: NOT_FOUND', null);
        }
        return token;
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
     * Get the trust token (for trusted device verification)
     */
    async getTrustToken(): Promise<string | null> {
        const token = this.storage.get(STORAGE_KEYS.TRUST_TOKEN);
        // Handle both sync and async storage adapters
        const resolvedToken = token instanceof Promise ? await token : token;
        
        if (resolvedToken) {
            this.log('debug', 'getTrustToken: Trust token found');
        } else {
            this.log('debug', 'getTrustToken: No trust token found');
        }
        
        return resolvedToken;
    }

    /**
     * Set the trust token
     */
    async setTrustToken(token: string): Promise<void> {
        this.log('debug', 'setTrustToken: Storing trust token');
        await Promise.resolve(this.storage.set(STORAGE_KEYS.TRUST_TOKEN, token));
        this.log('debug', 'setTrustToken: Trust token stored successfully');
    }

    /**
     * Clear the trust token
     */
    async clearTrustToken(): Promise<void> {
        this.log('debug', 'clearTrustToken: Clearing trust token');
        await Promise.resolve(this.storage.remove(STORAGE_KEYS.TRUST_TOKEN));
        this.log('debug', 'clearTrustToken: Trust token cleared');
    }

    /**
     * Clear all tokens
     */
    async clearTokens(): Promise<void> {
        this.log('debug', 'clearTokens: Clearing all tokens');
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
     * Get authorization header value (for header mode)
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
}

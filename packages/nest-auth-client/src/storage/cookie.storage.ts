/**
 * Cookie storage adapter for non-httpOnly cookies
 * Useful when you need client-side cookie access
 */

import { StorageAdapter } from '../types/config.types';

/**
 * Check if we're in a browser environment
 */
const isBrowser = (): boolean => {
    return typeof document !== 'undefined';
};

/**
 * Cookie options for storage
 */
export interface CookieOptions {
    /** Cookie path (default: '/') */
    path?: string;
    /** Cookie domain */
    domain?: string;
    /** Secure flag (default: true in production) */
    secure?: boolean;
    /** SameSite attribute (default: 'lax') */
    sameSite?: 'strict' | 'lax' | 'none';
    /** Max age in seconds */
    maxAge?: number;
}

/**
 * Cookie-based storage adapter
 * 
 * Note: This is for non-httpOnly cookies only.
 * For httpOnly cookie authentication, use accessTokenType: 'cookie' in config
 * and let the server set/manage the cookies.
 * 
 * Use cases:
 * - Storing non-sensitive tokens that need to be sent with requests
 * - Cross-subdomain authentication
 * - Edge cases where localStorage/sessionStorage is not available
 */
export class CookieStorageAdapter implements StorageAdapter {
    private prefix: string;
    private options: CookieOptions;

    /**
     * Create a Cookie storage adapter
     * @param prefix - Key prefix for namespacing (default: 'nest_auth_')
     * @param options - Cookie options
     */
    constructor(prefix: string = 'nest_auth_', options: CookieOptions = {}) {
        this.prefix = prefix;
        this.options = {
            path: '/',
            secure: typeof location !== 'undefined' && location.protocol === 'https:',
            sameSite: 'lax',
            ...options,
        };
    }

    private getKey(key: string): string {
        return `${this.prefix}${key}`;
    }

    private getCookie(name: string): string | null {
        if (!isBrowser()) return null;
        const nameEQ = name + '=';
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i].trim();
            if (c.indexOf(nameEQ) === 0) {
                return decodeURIComponent(c.substring(nameEQ.length));
            }
        }
        return null;
    }

    private setCookie(name: string, value: string): void {
        if (!isBrowser()) return;
        const { path, domain, secure, sameSite, maxAge } = this.options;
        let cookie = `${name}=${encodeURIComponent(value)}`;
        if (path) cookie += `; path=${path}`;
        if (domain) cookie += `; domain=${domain}`;
        if (secure) cookie += '; secure';
        if (sameSite) cookie += `; samesite=${sameSite}`;
        if (maxAge !== undefined) cookie += `; max-age=${maxAge}`;
        document.cookie = cookie;
    }

    private deleteCookie(name: string): void {
        if (!isBrowser()) return;
        const { path, domain } = this.options;
        let cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        if (path) cookie += `; path=${path}`;
        if (domain) cookie += `; domain=${domain}`;
        document.cookie = cookie;
    }

    get(key: string): string | null {
        return this.getCookie(this.getKey(key));
    }

    set(key: string, value: string): void {
        this.setCookie(this.getKey(key), value);
    }

    remove(key: string): void {
        this.deleteCookie(this.getKey(key));
    }

    clear(): void {
        if (!isBrowser()) return;
        // Find and delete all cookies with our prefix
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const [name] = cookie.trim().split('=');
            if (name.startsWith(this.prefix)) {
                this.deleteCookie(name);
            }
        }
    }
}

/**
 * LocalStorage adapter for browser environments
 * Persists tokens across page refreshes and browser sessions
 */

import { StorageAdapter } from '../types';

/**
 * Check if we're in a browser environment with localStorage
 */
const isBrowser = (): boolean => {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
};

/**
 * LocalStorage-based storage adapter
 * 
 * Features:
 * - Persists tokens across page refreshes
 * - Persists across browser sessions (until explicitly cleared)
 * - SSR-safe (returns null when not in browser)
 * 
 * Security considerations:
 * - Vulnerable to XSS attacks (tokens accessible via JavaScript)
 * - Use httpOnly cookies for sensitive applications
 */
export class LocalStorageAdapter implements StorageAdapter {
    private prefix: string;

    /**
     * Create a LocalStorage adapter
     * @param prefix - Key prefix for namespacing (default: 'nest_auth_')
     */
    constructor(prefix: string = 'nest_auth_') {
        this.prefix = prefix;
    }

    private getKey(key: string): string {
        return `${this.prefix}${key}`;
    }

    get(key: string): string | null {
        if (!isBrowser()) return null;
        try {
            return localStorage.getItem(this.getKey(key));
        } catch {
            return null;
        }
    }

    set(key: string, value: string): void {
        if (!isBrowser()) return;
        try {
            localStorage.setItem(this.getKey(key), value);
        } catch {
            // Storage full or access denied
        }
    }

    remove(key: string): void {
        if (!isBrowser()) return;
        try {
            localStorage.removeItem(this.getKey(key));
        } catch {
            // Access denied
        }
    }

    clear(): void {
        if (!isBrowser()) return;
        try {
            // Only remove keys with our prefix
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith(this.prefix)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
        } catch {
            // Access denied
        }
    }
}

/**
 * SessionStorage adapter for browser environments
 * Persists tokens only for the browser session (cleared when tab closes)
 */

import { StorageAdapter } from '../types';

/**
 * Check if we're in a browser environment with sessionStorage
 */
const isBrowser = (): boolean => {
    return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
};

/**
 * SessionStorage-based storage adapter
 * 
 * Features:
 * - Persists tokens across page refreshes
 * - Cleared when the browser tab/window is closed
 * - SSR-safe (returns null when not in browser)
 * 
 * Use cases:
 * - When you want users to re-authenticate after closing the browser
 * - More secure than localStorage for sensitive applications
 */
export class SessionStorageAdapter implements StorageAdapter {
    private prefix: string;

    /**
     * Create a SessionStorage adapter
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
            return sessionStorage.getItem(this.getKey(key));
        } catch {
            return null;
        }
    }

    set(key: string, value: string): void {
        if (!isBrowser()) return;
        try {
            sessionStorage.setItem(this.getKey(key), value);
        } catch {
            // Storage full or access denied
        }
    }

    remove(key: string): void {
        if (!isBrowser()) return;
        try {
            sessionStorage.removeItem(this.getKey(key));
        } catch {
            // Access denied
        }
    }

    clear(): void {
        if (!isBrowser()) return;
        try {
            // Only remove keys with our prefix
            const keysToRemove: string[] = [];
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key?.startsWith(this.prefix)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => sessionStorage.removeItem(key));
        } catch {
            // Access denied
        }
    }
}

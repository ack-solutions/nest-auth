/**
 * In-memory storage adapter
 * Safe for SSR and the default storage option
 */

import { StorageAdapter } from '../types';

/**
 * Memory-based storage adapter
 * 
 * This is the default and safest storage option:
 * - Works in all environments (Node, browser, React Native)
 * - SSR-safe (no window/localStorage access)
 * - Tokens are lost on page refresh (use for short sessions)
 * 
 * For persistent storage, use LocalStorageAdapter or SessionStorageAdapter
 */
export class MemoryStorage implements StorageAdapter {
    private store = new Map<string, string>();

    get(key: string): string | null {
        return this.store.get(key) ?? null;
    }

    set(key: string, value: string): void {
        this.store.set(key, value);
    }

    remove(key: string): void {
        this.store.delete(key);
    }

    clear(): void {
        this.store.clear();
    }
}

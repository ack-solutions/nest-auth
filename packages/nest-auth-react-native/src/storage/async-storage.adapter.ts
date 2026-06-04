import type { StorageAdapter } from '@ackplus/nest-auth-client';

/**
 * The subset of `@react-native-async-storage/async-storage` this adapter needs.
 * We inject the storage object instead of importing the native module directly,
 * so this package has no native dependency and stays testable in plain Node.
 */
export interface AsyncStorageLike {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    /** Optional — enables a scoped `clear()`. AsyncStorage implements these. */
    getAllKeys?(): Promise<readonly string[]>;
    multiRemove?(keys: string[]): Promise<void>;
}

/**
 * A {@link StorageAdapter} backed by React Native AsyncStorage (or any
 * compatible key/value store). Keys are namespaced with a prefix so the auth
 * SDK never collides with the rest of your app's storage.
 *
 * @example
 * ```ts
 * import AsyncStorage from '@react-native-async-storage/async-storage';
 * import { AsyncStorageAdapter, createNestAuthClient } from '@ackplus/nest-auth-react-native';
 *
 * const client = createNestAuthClient({
 *   baseUrl: 'https://api.example.com',
 *   storage: new AsyncStorageAdapter(AsyncStorage),
 * });
 * ```
 */
export class AsyncStorageAdapter implements StorageAdapter {
    constructor(
        private readonly storage: AsyncStorageLike,
        private readonly prefix = 'nest_auth.',
    ) {}

    private k(key: string): string {
        return this.prefix + key;
    }

    get(key: string): Promise<string | null> {
        return this.storage.getItem(this.k(key));
    }

    async set(key: string, value: string): Promise<void> {
        await this.storage.setItem(this.k(key), value);
    }

    async remove(key: string): Promise<void> {
        await this.storage.removeItem(this.k(key));
    }

    async clear(): Promise<void> {
        if (this.storage.getAllKeys && this.storage.multiRemove) {
            const all = await this.storage.getAllKeys();
            const mine = all.filter((k) => k.startsWith(this.prefix));
            if (mine.length) {
                await this.storage.multiRemove(mine);
            }
        }
    }
}

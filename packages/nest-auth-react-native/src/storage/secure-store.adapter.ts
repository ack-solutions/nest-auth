import type { StorageAdapter } from '@ackplus/nest-auth-client';

/**
 * The subset of `expo-secure-store` this adapter needs. Injected (not imported)
 * so the package carries no Expo dependency and stays testable in plain Node.
 */
export interface SecureStoreLike {
    getItemAsync(key: string): Promise<string | null>;
    setItemAsync(key: string, value: string): Promise<void>;
    deleteItemAsync(key: string): Promise<void>;
}

/**
 * A {@link StorageAdapter} backed by Expo SecureStore — tokens are kept in the
 * device keychain / keystore rather than plain AsyncStorage. Recommended for
 * production apps holding long-lived refresh tokens.
 *
 * SecureStore keys may only contain alphanumerics plus `.`, `-`, `_`; the
 * default prefix respects that.
 *
 * @example
 * ```ts
 * import * as SecureStore from 'expo-secure-store';
 * import { SecureStoreAdapter, createNestAuthClient } from '@ackplus/nest-auth-react-native';
 *
 * const client = createNestAuthClient({
 *   baseUrl: 'https://api.example.com',
 *   storage: new SecureStoreAdapter(SecureStore),
 * });
 * ```
 */
export class SecureStoreAdapter implements StorageAdapter {
    constructor(
        private readonly store: SecureStoreLike,
        private readonly prefix = 'nest_auth.',
    ) {}

    private k(key: string): string {
        return this.prefix + key;
    }

    get(key: string): Promise<string | null> {
        return this.store.getItemAsync(this.k(key));
    }

    async set(key: string, value: string): Promise<void> {
        await this.store.setItemAsync(this.k(key), value);
    }

    async remove(key: string): Promise<void> {
        await this.store.deleteItemAsync(this.k(key));
    }
}

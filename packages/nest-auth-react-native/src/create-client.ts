import { AuthClient } from '@ackplus/nest-auth-client';
import type { AuthClientConfig, StorageAdapter } from '@ackplus/nest-auth-client';

/**
 * Config for {@link createNestAuthClient}. Identical to the core
 * `AuthClientConfig` except `storage` is **required** — on React Native there is
 * no implicit browser storage, so you must pass an adapter (AsyncStorage or
 * SecureStore).
 */
export interface NestAuthRNConfig extends Omit<AuthClientConfig, 'storage'> {
    storage: StorageAdapter;
}

/**
 * Create an {@link AuthClient} tuned for React Native / Expo:
 *
 * - **header token mode** — RN can't use http-only cookies, so tokens are sent
 *   in the `Authorization` header and persisted via your storage adapter.
 * - **persistent storage** — pass an {@link AsyncStorageAdapter} or
 *   {@link SecureStoreAdapter} so sessions survive app restarts.
 *
 * Everything else (auto-refresh, endpoints, callbacks) matches the web client.
 *
 * @example
 * ```ts
 * import AsyncStorage from '@react-native-async-storage/async-storage';
 * import { createNestAuthClient, AsyncStorageAdapter } from '@ackplus/nest-auth-react-native';
 *
 * export const authClient = createNestAuthClient({
 *   baseUrl: 'https://api.example.com',
 *   storage: new AsyncStorageAdapter(AsyncStorage),
 * });
 * ```
 */
export function createNestAuthClient(config: NestAuthRNConfig): AuthClient {
    return new AuthClient({
        // RN default — overridable if the caller really wants cookie mode.
        accessTokenType: 'header',
        ...config,
    });
}

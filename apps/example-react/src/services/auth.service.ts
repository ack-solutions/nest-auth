import type { AuthClient, ISessionUserData } from '@ackplus/nest-auth-client';

/**
 * Thin helpers around {@link AuthClient} for the example app (profile refresh, etc.).
 */
export function createAuthService(client: AuthClient) {
    return {
        /**
         * Re-validates the session with the server and returns the updated user (also on `client.getUser()`).
         */
        async getCurrentUser(): Promise<ISessionUserData | null> {
            await client.verifySession();
            return client.getUser();
        },
    };
}

export type ExampleAuthService = ReturnType<typeof createAuthService>;

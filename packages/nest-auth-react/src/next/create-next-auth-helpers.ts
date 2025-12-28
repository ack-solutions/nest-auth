/**
 * Next.js helpers for auth
 */

import {
    AuthClient,
    AuthClientConfig,
    IAuthUser,
    ClientSession,
} from '@ackplus/nest-auth-client';

/**
 * Server-side auth state
 */
export interface ServerAuthState {
    user: IAuthUser | null;
    session: ClientSession | null;
}

/**
 * Next.js auth helpers
 */
export interface NextAuthHelpers {
    /**
     * Get auth state from server request
     * Works with App Router's Request or headers
     */
    getServerAuth: (request: Request | { cookies: { get: (name: string) => { value: string } | undefined } }) => Promise<ServerAuthState>;

    /**
     * HOF to protect API routes/route handlers
     */
    withAuth: <T extends (...args: any[]) => any>(handler: T) => T;

    /**
     * Create initial state for hydration
     */
    createInitialState: (serverAuth: ServerAuthState) => { user: IAuthUser | null; session: ClientSession | null };
}

/**
 * Cookie names used by nest-auth
 */
const COOKIE_NAMES = {
    ACCESS_TOKEN: 'access_token',
    REFRESH_TOKEN: 'refresh_token',
};

/**
 * Create Next.js auth helpers
 * 
 * @example
 * ```typescript
 * // lib/auth.ts
 * import { createNextAuthHelpers } from '@ackplus/nest-auth-react';
 * 
 * export const { getServerAuth, withAuth, createInitialState } = createNextAuthHelpers({
 *   baseUrl: process.env.API_URL!,
 * });
 * 
 * // app/page.tsx (Server Component)
 * import { getServerAuth, createInitialState } from '@/lib/auth';
 * import { cookies } from 'next/headers';
 * 
 * export default async function Page() {
 *   const auth = await getServerAuth({ cookies: await cookies() });
 *   return <ClientComponent initialState={createInitialState(auth)} />;
 * }
 * ```
 */
/**
 * Configuration for Next.js auth helpers
 */
export interface NextAuthHelpersConfig extends AuthClientConfig {
    /**
     * Custom cookie names
     */
    cookieNames?: {
        accessToken?: string;
        refreshToken?: string;
    };
}

/**
 * Create Next.js auth helpers
 * 
 * @example
 * ```typescript
 * // lib/auth.ts
 * import { createNextAuthHelpers } from '@ackplus/nest-auth-react';
 * 
 * export const { getServerAuth, withAuth, createInitialState } = createNextAuthHelpers({
 *   baseUrl: process.env.API_URL!,
 *   cookieNames: {
 *     accessToken: 'my_app_access_token',
 *   },
 * });
 * 
 * // app/page.tsx (Server Component)
 * import { getServerAuth, createInitialState } from '@/lib/auth';
 * import { cookies } from 'next/headers';
 * 
 * export default async function Page() {
 *   const auth = await getServerAuth({ cookies: await cookies() });
 *   return <ClientComponent initialState={createInitialState(auth)} />;
 * }
 * ```
 */
export function createNextAuthHelpers(config: NextAuthHelpersConfig): NextAuthHelpers {
    const cookieNames = {
        accessToken: config.cookieNames?.accessToken || COOKIE_NAMES.ACCESS_TOKEN,
        refreshToken: config.cookieNames?.refreshToken || COOKIE_NAMES.REFRESH_TOKEN,
    };
    const getServerAuth = async (
        request: Request | { cookies: { get: (name: string) => { value: string } | undefined } }
    ): Promise<ServerAuthState> => {
        try {
            // Extract access token from cookies
            let accessToken: string | undefined;

            if (request instanceof Request) {
                // Standard Request object (App Router route handlers)
                const cookieHeader = request.headers.get('cookie');
                if (cookieHeader) {
                    const cookies = parseCookies(cookieHeader);
                    accessToken = cookies[cookieNames.accessToken];
                }
            } else {
                // Next.js cookies() object
                accessToken = request.cookies.get(cookieNames.accessToken)?.value;
            }

            if (!accessToken) {
                return { user: null, session: null };
            }

            // Create a server-side client to fetch user
            const serverClient = new AuthClient({
                ...config,
                accessTokenType: 'header',
            });

            // Set the token manually for the request
            const response = await fetch(`${config.baseUrl}${config.endpoints?.verifySession || '/auth/verify-session'}`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                cache: 'no-store',
            });

            if (!response.ok) {
                return { user: null, session: null };
            }

            const user = await response.json();

            return {
                user,
                session: {
                    id: '',
                    userId: user.id,
                    accessToken,
                },
            };
        } catch {
            return { user: null, session: null };
        }
    };

    const withAuth = <T extends (...args: any[]) => any>(handler: T): T => {
        return (async (...args: Parameters<T>) => {
            // For API routes, get request from args
            const request = args[0] as Request;
            const auth = await getServerAuth(request);

            if (!auth.user) {
                return new Response(JSON.stringify({ message: 'Unauthorized' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            // Add auth to request context (via headers)
            const headers = new Headers(request.headers);
            headers.set('x-auth-user', JSON.stringify(auth.user));

            return handler(...args);
        }) as T;
    };

    const createInitialState = (serverAuth: ServerAuthState) => {
        return {
            user: serverAuth.user,
            session: serverAuth.session,
        };
    };

    return {
        getServerAuth,
        withAuth,
        createInitialState,
    };
}

/**
 * Parse cookie header string
 */
function parseCookies(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {};

    cookieHeader.split(';').forEach(cookie => {
        const [name, ...rest] = cookie.trim().split('=');
        if (name) {
            cookies[name] = rest.join('=');
        }
    });

    return cookies;
}

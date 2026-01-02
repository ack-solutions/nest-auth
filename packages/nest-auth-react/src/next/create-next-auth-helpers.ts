/**
 * Next.js helpers for auth
 */

import {
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
 * 
 * IMPORTANT: These values MUST match the backend constants defined in:
 * @ackplus/nest-auth -> src/lib/auth.constants.ts
 * 
 * - ACCESS_TOKEN_COOKIE_NAME = 'accessToken'
 * - REFRESH_TOKEN_COOKIE_NAME = 'refreshToken'
 * 
 * Do NOT change these values unless you also update the backend.
 */
const COOKIE_NAMES = {
    ACCESS_TOKEN: 'accessToken',
    REFRESH_TOKEN: 'refreshToken',
} as const;

/**
 * Configuration for Next.js auth helpers
 * 
 * Note: Cookie names are automatically matched to the backend defaults:
 * - accessToken: 'accessToken'
 * - refreshToken: 'refreshToken'
 * 
 * Cookie names cannot be customized on the client side as they must
 * match the backend configuration for authentication to work properly.
 */
export interface NextAuthHelpersConfig extends AuthClientConfig {
    /**
     * Enable debug logging to console
     * When enabled, logs will show auth operations in browser/terminal console
     * @default false
     */
    debug?: boolean;
}

/**
 * Simple debug logger for Next.js auth helpers
 */
class NextAuthDebugLogger {
    private enabled: boolean;
    private prefix = '[NestAuth]';

    constructor(enabled: boolean = false) {
        this.enabled = enabled;
    }

    private formatMessage(message: string, context?: string): string {
        const timestamp = new Date().toISOString();
        return context 
            ? `${this.prefix} [${timestamp}] [${context}] ${message}`
            : `${this.prefix} [${timestamp}] ${message}`;
    }

    debug(message: string, context?: string, data?: any): void {
        if (!this.enabled) return;
        const formatted = this.formatMessage(message, context);
        if (data) {
            console.log(formatted, data);
        } else {
            console.log(formatted);
        }
    }

    warn(message: string, context?: string, data?: any): void {
        if (!this.enabled) return;
        const formatted = this.formatMessage(message, context);
        if (data) {
            console.warn(formatted, data);
        } else {
            console.warn(formatted);
        }
    }

    error(message: string, context?: string, data?: any): void {
        if (!this.enabled) return;
        const formatted = this.formatMessage(message, context);
        if (data) {
            console.error(formatted, data);
        } else {
            console.error(formatted);
        }
    }

    verbose(message: string, context?: string, data?: any): void {
        if (!this.enabled) return;
        const formatted = this.formatMessage(message, context);
        if (data) {
            console.debug(formatted, data);
        } else {
            console.debug(formatted);
        }
    }
}

/**
 * Create Next.js auth helpers
 * 
 * Provides server-side utilities for Next.js App Router to:
 * - Read authentication state from cookies
 * - Protect API routes
 * - Hydrate client-side auth state
 * 
 * @example
 * ```typescript
 * // lib/auth.server.ts (no 'use client' directive)
 * import { createNextAuthHelpers } from '@ackplus/nest-auth-react';
 * 
 * export const { getServerAuth, withAuth, createInitialState } = createNextAuthHelpers({
 *   baseUrl: process.env.API_URL!,
 *   debug: process.env.NODE_ENV === 'development', // Enable debug logs in development
 * });
 * 
 * // app/layout.tsx (Server Component)
 * import { getServerAuth, createInitialState } from '@/lib/auth.server';
 * import { cookies } from 'next/headers';
 * 
 * export default async function RootLayout({ children }) {
 *   const auth = await getServerAuth({ cookies: await cookies() });
 *   return (
 *     <html>
 *       <body>
 *         <AuthProvider initialState={createInitialState(auth)}>
 *           {children}
 *         </AuthProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function createNextAuthHelpers(config: NextAuthHelpersConfig): NextAuthHelpers {
    const logger = new NextAuthDebugLogger(config.debug);

    const getServerAuth = async (
        request: Request | { cookies: { get: (name: string) => { value: string } | undefined } }
    ): Promise<ServerAuthState> => {
        logger.debug('getServerAuth called', 'NextAuthHelpers');
        
        try {
            // Extract access token from cookies using fixed cookie names
            let accessToken: string | undefined;

            if (request instanceof Request) {
                // Standard Request object (App Router route handlers)
                logger.verbose('Extracting token from Request object', 'NextAuthHelpers');
                const cookieHeader = request.headers.get('cookie');
                if (cookieHeader) {
                    const cookies = parseCookies(cookieHeader);
                    accessToken = cookies[COOKIE_NAMES.ACCESS_TOKEN];
                    logger.debug(
                        `Cookie header found, accessToken: ${accessToken ? 'present' : 'missing'}`,
                        'NextAuthHelpers'
                    );
                } else {
                    logger.debug('No cookie header in request', 'NextAuthHelpers');
                }
            } else {
                // Next.js cookies() object
                logger.verbose('Extracting token from Next.js cookies object', 'NextAuthHelpers');
                accessToken = request.cookies.get(COOKIE_NAMES.ACCESS_TOKEN)?.value;
                logger.debug(
                    `accessToken from cookies(): ${accessToken ? 'present' : 'missing'}`,
                    'NextAuthHelpers'
                );
            }

            if (!accessToken) {
                logger.debug('No access token found - returning null auth state', 'NextAuthHelpers');
                return { user: null, session: null };
            }

            // Verify the session with the backend
            const verifyUrl = `${config.baseUrl}${config.endpoints?.verifySession || '/auth/verify-session'}`;
            logger.debug(`Verifying session with backend: ${verifyUrl}`, 'NextAuthHelpers');
            
            const response = await fetch(verifyUrl, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                cache: 'no-store',
            });

            if (!response.ok) {
                logger.warn(
                    `Session verification failed: ${response.status} ${response.statusText}`,
                    'NextAuthHelpers'
                );
                return { user: null, session: null };
            }

            const user = await response.json();
            logger.debug(
                'Session verified successfully',
                'NextAuthHelpers',
                { userId: user.id }
            );

            return {
                user,
                session: {
                    id: '',
                    userId: user.id,
                    accessToken,
                },
            };
        } catch (error) {
            logger.error(
                `Error in getServerAuth: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'NextAuthHelpers',
                error
            );
            return { user: null, session: null };
        }
    };

    const withAuth = <T extends (...args: any[]) => any>(handler: T): T => {
        return (async (...args: Parameters<T>) => {
            logger.debug('withAuth wrapper called', 'NextAuthHelpers');
            
            // For API routes, get request from args
            const request = args[0] as Request;
            const auth = await getServerAuth(request);

            if (!auth.user) {
                logger.warn('withAuth: No authenticated user - returning 401', 'NextAuthHelpers');
                return new Response(JSON.stringify({ message: 'Unauthorized' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            logger.debug(
                'withAuth: User authenticated, proceeding to handler',
                'NextAuthHelpers',
                { userId: auth.user.id }
            );

            // Add auth to request context (via headers)
            const headers = new Headers(request.headers);
            headers.set('x-auth-user', JSON.stringify(auth.user));

            return handler(...args);
        }) as T;
    };

    const createInitialState = (serverAuth: ServerAuthState) => {
        logger.debug(
            'createInitialState called',
            'NextAuthHelpers',
            { hasUser: !!serverAuth.user, hasSession: !!serverAuth.session }
        );
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
 * Parse cookie header string into key-value pairs
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


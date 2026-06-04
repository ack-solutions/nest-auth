/**
 * Small, readable helpers over supertest so the e2e specs read like real API
 * usage. Every route here goes through the `/api` global prefix (see main.ts).
 *
 * These intentionally use the SAME request/response shapes a real frontend (the
 * example-react / example-next apps + the `@ackplus/nest-auth-client` SDK) sends:
 *   - signup:  POST /api/auth/signup   { email|phone, password, metadata? }
 *   - login:   POST /api/auth/login    { providerName, credentials }
 */

import request from 'supertest';

/** Unique email per call so a single in-memory DB can host many tests. */
export function uniqueEmail(prefix = 'user'): string {
    return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.test`;
}

/** Unique E.164-ish phone per call. */
export function uniquePhone(): string {
    const n = Math.floor(1_000_000 + Math.random() * 8_999_999);
    return `+1555${n}`;
}

/** Pull tokens out regardless of where the response nests them. */
export function extractTokens(body: any): { accessToken?: string; refreshToken?: string } {
    return {
        accessToken: body?.accessToken ?? body?.tokens?.accessToken ?? body?.data?.accessToken,
        refreshToken: body?.refreshToken ?? body?.tokens?.refreshToken ?? body?.data?.refreshToken,
    };
}

/** Decode (NOT verify) a JWT's payload claims. */
export function jwtClaims(token: string): Record<string, any> {
    const payload = token.split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

/** The authenticated user's id, read straight off the access-token claims. */
export function userIdFromToken(token: string): string {
    const c = jwtClaims(token);
    return c.sub ?? c.id ?? c.userId;
}

export interface SignupBody {
    email?: string;
    phone?: string;
    password: string;
    metadata?: Record<string, unknown>;
}

/** POST /api/auth/signup */
export function signup(http: any, body: SignupBody) {
    return request(http).post('/api/auth/signup').send(body);
}

/** POST /api/auth/login with email + password. */
export function loginEmail(http: any, email: string, password: string) {
    return request(http)
        .post('/api/auth/login')
        .send({ providerName: 'email', credentials: { email, password } });
}

/** POST /api/auth/login with phone + password. */
export function loginPhone(http: any, phone: string, password: string) {
    return request(http)
        .post('/api/auth/login')
        .send({ providerName: 'phone', credentials: { phone, password } });
}

/**
 * Sign up a fresh email user and return their tokens + credentials.
 * Throws (with the server body) if signup didn't return an access token, so a
 * setup failure surfaces clearly instead of as a confusing downstream 401.
 */
export async function signupEmailUser(
    http: any,
    overrides: Partial<SignupBody> = {},
): Promise<{ email: string; password: string; accessToken: string; refreshToken?: string; userId?: string }> {
    const email = overrides.email ?? uniqueEmail();
    const password = overrides.password ?? 'StrongPassword!1';
    const res = await signup(http, { email, password, metadata: overrides.metadata });
    const { accessToken, refreshToken } = extractTokens(res.body);
    if (!accessToken) {
        throw new Error(
            `signupEmailUser: expected an access token, got ${res.status}: ${JSON.stringify(res.body)}`,
        );
    }
    const userId = res.body?.user?.id ?? res.body?.data?.user?.id ?? res.body?.userId;
    return { email, password, accessToken, refreshToken, userId };
}

/** Authorization header for a bearer token. */
export function bearer(token: string): [string, string] {
    return ['Authorization', `Bearer ${token}`];
}

/**
 * Poll `fn` until `predicate` is satisfied (or attempts run out). Useful for
 * eventually-consistent flows like the `@OnEvent` cross-system-sync listener,
 * which runs after the HTTP response has already been sent.
 */
export async function waitFor<T>(
    fn: () => Promise<T>,
    predicate: (v: T) => boolean,
    { tries = 25, delayMs = 40 }: { tries?: number; delayMs?: number } = {},
): Promise<T> {
    let last = await fn();
    for (let i = 0; i < tries; i++) {
        if (predicate(last)) return last;
        await new Promise((r) => setTimeout(r, delayMs));
        last = await fn();
    }
    return last;
}

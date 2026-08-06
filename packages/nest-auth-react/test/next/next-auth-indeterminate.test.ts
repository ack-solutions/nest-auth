/**
 * The Next.js SSR helpers must apply THE RULE too: only a definitive 401/403 is
 * "logged out". A backend 5xx, timeout, or network failure during `getServerAuth`
 * is INDETERMINATE — `withAuth` must return a retryable 503, not a 401 that
 * bounces the user to login during a transient outage.
 *
 * NO MOCKS. A real Node HTTP server stands in for the backend; a closed port
 * produces the network failure.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createNextAuthHelpers } from '../../src/next/create-next-auth-helpers';
import { resolveInitialStatus } from '../../src/next/next-auth-provider';

let server: Server;
let baseUrl: string;
let verifyStatus = 200;

beforeAll(async () => {
    server = createServer((req, res) => {
        if (verifyStatus === 200) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ id: 'u1', email: 'a@b.com' }));
        }
        res.statusCode = verifyStatus;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ message: 'nope' }));
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});

afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
});

beforeEach(() => { verifyStatus = 200; });

function helpers(url = baseUrl) {
    return createNextAuthHelpers({ baseUrl: url, endpoints: { verifySession: '/auth/verify-session' } } as any);
}

/** A Next.js `cookies()`-shaped object carrying a seeded access token. */
const reqWithToken = {
    cookies: { get: (name: string) => (name === 'accessToken' ? { value: 'seeded-at' } : undefined) },
};

describe('getServerAuth — classifies indeterminate vs definitive', () => {
    it('backend 503 → indeterminate (not logged out)', async () => {
        verifyStatus = 503;
        const auth = await helpers().getServerAuth(reqWithToken as any);
        expect(auth.user).toBeNull();
        expect(auth.indeterminate).toBe(true);
        expect(auth.statusCode).toBe(503);
    });

    it('backend 401 → definitive rejection (NOT indeterminate)', async () => {
        verifyStatus = 401;
        const auth = await helpers().getServerAuth(reqWithToken as any);
        expect(auth.user).toBeNull();
        expect(auth.indeterminate).toBeFalsy();
    });

    it('network failure (dead port) → indeterminate', async () => {
        const probe = await new Promise<number>((resolve) => {
            const s = createServer();
            s.listen(0, '127.0.0.1', () => { const p = (s.address() as any).port; s.close(() => resolve(p)); });
        });
        const auth = await helpers(`http://127.0.0.1:${probe}`).getServerAuth(reqWithToken as any);
        expect(auth.user).toBeNull();
        expect(auth.indeterminate).toBe(true);
    });

    it('backend 200 → authenticated, not indeterminate', async () => {
        verifyStatus = 200;
        const auth = await helpers().getServerAuth(reqWithToken as any);
        expect(auth.user?.id).toBe('u1');
        expect(auth.indeterminate).toBeFalsy();
    });
});

describe('withAuth — 503 on outage, 401 on real rejection', () => {
    const handler = async () => new Response('secret', { status: 222 });

    it('indeterminate (503 backend) → 503, NOT 401', async () => {
        verifyStatus = 503;
        const res: Response = await helpers().withAuth(handler)(reqWithToken as any);
        expect(res.status).toBe(503);
        expect(res.headers.get('Retry-After')).toBe('5');
    });

    it('definitive 401 backend → 401', async () => {
        verifyStatus = 401;
        const res: Response = await helpers().withAuth(handler)(reqWithToken as any);
        expect(res.status).toBe(401);
    });

    it('authenticated → runs the handler', async () => {
        verifyStatus = 200;
        const res: Response = await helpers().withAuth(handler)(reqWithToken as any);
        expect(res.status).toBe(222);
    });
});

describe('SSR hydration (resolveInitialStatus) — an outage must NOT hydrate as logged-out', () => {
    it('user present → authenticated', () => {
        expect(resolveInitialStatus({ user: { id: 'u1' } as any })).toBe('authenticated');
    });
    it('no user + indeterminate (outage) → unknown, NOT unauthenticated', () => {
        expect(resolveInitialStatus({ user: null, indeterminate: true })).toBe('unknown');
    });
    it('no user + definitive (reached the server) → unauthenticated', () => {
        expect(resolveInitialStatus({ user: null, indeterminate: false })).toBe('unauthenticated');
        expect(resolveInitialStatus({ user: null })).toBe('unauthenticated');
    });
    it('no initial state (client-only) → loading', () => {
        expect(resolveInitialStatus(undefined)).toBe('loading');
    });

    it('END-TO-END: a 503 SSR outage hydrates as "unknown" (no login redirect)', async () => {
        verifyStatus = 503;
        const h = helpers();
        const serverAuth = await h.getServerAuth(reqWithToken as any);
        const initial = h.createInitialState(serverAuth);
        expect(initial.indeterminate).toBe(true); // flag survives createInitialState
        expect(resolveInitialStatus(initial)).toBe('unknown'); // → guards render loading, never redirect
    });

    it('END-TO-END: a genuine 401 SSR result hydrates as "unauthenticated"', async () => {
        verifyStatus = 401;
        const h = helpers();
        const serverAuth = await h.getServerAuth(reqWithToken as any);
        const initial = h.createInitialState(serverAuth);
        expect(initial.indeterminate).toBeFalsy();
        expect(resolveInitialStatus(initial)).toBe('unauthenticated');
    });
});

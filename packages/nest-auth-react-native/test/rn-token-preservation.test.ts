/**
 * The React Native SDK re-exports the core client + React provider, so it
 * inherits THE RULE: only a definitive 401/403 ends a session; an INDETERMINATE
 * failure (network / timeout / 429 / 5xx) must leave stored tokens intact.
 *
 * This locks it in at the RN entry point: a client built with
 * `createNestAuthClient` (header mode + a real AsyncStorage-like store) keeps its
 * tokens when refresh gets a 502.
 *
 * NO MOCKS. A real Node HTTP server stands in for the backend.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createNestAuthClient, AsyncStorageAdapter, type AsyncStorageLike } from '../src';

function jwt(payload: Record<string, unknown>): string {
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ exp: Math.floor(Date.now() / 1000) + 3600, ...payload })}.sig`;
}

function memoryAsyncStorage(): AsyncStorageLike {
    const m = new Map<string, string>();
    return {
        getItem: async (k) => (m.has(k) ? m.get(k)! : null),
        setItem: async (k, v) => { m.set(k, v); },
        removeItem: async (k) => { m.delete(k); },
        getAllKeys: async () => Array.from(m.keys()),
        multiRemove: async (keys) => { keys.forEach((k) => m.delete(k)); },
    };
}

let server: Server;
let baseUrl: string;
let refreshStatus = 502;

beforeAll(async () => {
    server = createServer((req, res) => {
        let raw = '';
        req.on('data', (c) => (raw += c));
        req.on('end', () => {
            const send = (status: number, body: unknown) => {
                res.statusCode = status;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(body));
            };
            if (req.url === '/auth/login') return send(200, { accessToken: jwt({ sub: 'u1' }), refreshToken: 'rt-1' });
            if (req.url === '/auth/refresh-token') return send(refreshStatus, { message: 'bad gateway' });
            send(404, {});
        });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});

afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
});

describe('React Native SDK inherits the indeterminate-error rule', () => {
    it('createNestAuthClient: a 502 refresh preserves tokens, emits no logout, throws kind "indeterminate"', async () => {
        const client = createNestAuthClient({ baseUrl, storage: new AsyncStorageAdapter(memoryAsyncStorage()) });
        await client.login({ providerName: 'email', credentials: { email: 'a@b.com', password: 'x' } } as any);
        expect(await client.getAccessToken()).toBeTruthy();

        let logouts = 0;
        client.onLogout(() => { logouts += 1; });

        refreshStatus = 502;
        await expect(client.refresh()).rejects.toMatchObject({ kind: 'indeterminate', statusCode: 502 });

        expect(logouts).toBe(0);
        expect(await client.getAccessToken()).toBeTruthy(); // NOT destroyed
    });
});

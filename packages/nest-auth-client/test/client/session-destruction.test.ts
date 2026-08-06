/**
 * THE RULE: a session may only be ended by a DEFINITIVE rejection — the server
 * answered refresh/verify with 401 (or 403). Everything else (the synthesised
 * status 0 for a network failure, timeout, 408, 429, all 5xx) is INDETERMINATE:
 * the client failed to ask, so it must NOT destroy tokens, must NOT emit logout,
 * and must surface a retryable error carrying `kind: 'indeterminate'`.
 *
 * NO MOCKS. A real Node HTTP server stands in for the backend and is programmed,
 * per test, to reject (401/403), fail (500/502), drop the socket (network →
 * status 0), or hang past the client timeout. Real client, real fetch, real
 * storage.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import { AuthClient } from '../../src/client/auth-client';
import { MemoryStorage } from '../../src/storage/memory.storage';
import { makeValidJwt } from '../fixtures/jwt.fixtures';

// --- programmable backend ------------------------------------------------------
type FailCtl = { status?: number; destroy?: boolean; delayMs?: number };
let server: Server;
let baseUrl: string;
let refreshCtl: FailCtl = {};
let verifyCtl: FailCtl = {};
let validToken: string; // the access token the server currently accepts
let issued = 0;
let tokenSeq = 0;
let logoutHits = 0; // count of POST /auth/logout the client makes

/** A genuinely UNIQUE token each call (makeValidJwt is deterministic per-claims). */
function mintToken(): string {
    return makeValidJwt({ sub: 'user-1', sid: ++tokenSeq });
}

function readBearer(req: any): string | undefined {
    const h = req.headers['authorization'];
    return typeof h === 'string' && h.startsWith('Bearer ') ? h.slice(7) : undefined;
}

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

            if (req.url === '/auth/login') {
                validToken = mintToken();
                return send(200, { accessToken: validToken, refreshToken: `rt-${++issued}` });
            }

            if (req.url === '/auth/logout') {
                logoutHits += 1;
                return send(200, {});
            }

            if (req.url === '/auth/refresh-token') {
                if (refreshCtl.destroy) return req.socket.destroy(); // network failure → status 0
                if (refreshCtl.delayMs) {
                    setTimeout(() => { try { send(500, { message: 'late' }); } catch { /* client already aborted */ } }, refreshCtl.delayMs);
                    return;
                }
                if (refreshCtl.status) return send(refreshCtl.status, { message: 'refresh failed' });
                validToken = mintToken(); // success: rotate the accepted token
                return send(200, { accessToken: validToken, refreshToken: `rt-${++issued}` });
            }

            if (req.url === '/auth/verify-session') {
                if (verifyCtl.destroy) return req.socket.destroy();
                if (verifyCtl.status) return send(verifyCtl.status, { message: 'verify failed' });
                // Token-tracking mode: only the currently-valid token verifies.
                return readBearer(req) === validToken
                    ? send(200, { valid: true, userId: 'user-1' })
                    : send(401, { valid: false });
            }

            send(404, { message: 'not found' });
        });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});

afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
});

function newClient(opts: { autoRefresh?: boolean } = {}) {
    return new AuthClient({
        baseUrl,
        accessTokenType: 'header',
        storage: new MemoryStorage(),
        autoRefresh: opts.autoRefresh ?? true,
        timeout: 400,
    });
}

async function seededClient(opts?: { autoRefresh?: boolean }) {
    const client = newClient(opts);
    await client.login({ providerName: 'email', credentials: { email: 'a@b.com', password: 'x' } } as any);
    expect(await client.getAccessToken()).toBeTruthy();
    return client;
}

beforeEach(() => {
    refreshCtl = {};
    verifyCtl = {};
    logoutHits = 0;
});

// --- refresh(): definitive rejection ends the session --------------------------
describe('refresh() — definitive rejection (401/403) ends the session', () => {
    it('401 clears auth state exactly once and emits logout, throws kind "rejected"', async () => {
        const client = await seededClient();
        let logouts = 0;
        client.onLogout(() => { logouts += 1; });

        refreshCtl = { status: 401 };
        await expect(client.refresh()).rejects.toMatchObject({ kind: 'rejected', statusCode: 401 });

        expect(logouts).toBe(1);
        expect(await client.getAccessToken()).toBeNull();
        expect(client.getIsAuthenticated()).toBe(false);
        // Definitive rejection clears via clearAuthState() — NOT logout(): no
        // pointless POST /auth/logout against a session the server already killed.
        expect(logoutHits).toBe(0);
    });

    it('403 clears auth state once and emits logout, throws kind "rejected"', async () => {
        const client = await seededClient();
        let logouts = 0;
        client.onLogout(() => { logouts += 1; });

        refreshCtl = { status: 403 };
        await expect(client.refresh()).rejects.toMatchObject({ kind: 'rejected', statusCode: 403 });

        expect(logouts).toBe(1);
        expect(await client.getAccessToken()).toBeNull();
    });
});

// --- refresh(): indeterminate failures MUST preserve the session ---------------
describe('refresh() — indeterminate failures preserve tokens (no logout, retryable)', () => {
    for (const status of [500, 502, 503, 429, 408]) {
        it(`${status} leaves tokens readable, emits no logout, throws kind "indeterminate"`, async () => {
            const client = await seededClient();
            let logouts = 0;
            client.onLogout(() => { logouts += 1; });

            refreshCtl = { status };
            await expect(client.refresh()).rejects.toMatchObject({ kind: 'indeterminate', statusCode: status });

            expect(logouts).toBe(0);
            expect(await client.getAccessToken()).toBeTruthy(); // NOT destroyed
            expect(client.getIsAuthenticated()).toBe(true);
        });
    }

    it('network failure (socket dropped → status 0) preserves tokens, no logout, kind "indeterminate"', async () => {
        const client = await seededClient();
        let logouts = 0;
        client.onLogout(() => { logouts += 1; });

        refreshCtl = { destroy: true };
        await expect(client.refresh()).rejects.toMatchObject({ kind: 'indeterminate', statusCode: 0 });

        expect(logouts).toBe(0);
        expect(await client.getAccessToken()).toBeTruthy();
    });

    it('timeout (server hangs past client timeout → status 0) preserves tokens, no logout', async () => {
        const client = await seededClient();
        let logouts = 0;
        client.onLogout(() => { logouts += 1; });

        refreshCtl = { delayMs: 1500 }; // client timeout is 400ms
        await expect(client.refresh()).rejects.toMatchObject({ kind: 'indeterminate' });

        expect(logouts).toBe(0);
        expect(await client.getAccessToken()).toBeTruthy();
    });
});

// --- verifySession(): "couldn't ask" is not "server said no" --------------------
describe('verifySession() — indeterminate throws, only 401/403 returns valid:false', () => {
    it('503 THROWS a retryable error (does not return valid:false)', async () => {
        const client = await seededClient({ autoRefresh: false });
        verifyCtl = { status: 503 };
        await expect(client.verifySession()).rejects.toMatchObject({ kind: 'indeterminate', statusCode: 503 });
    });

    it('network failure THROWS (does not return valid:false)', async () => {
        const client = await seededClient({ autoRefresh: false });
        verifyCtl = { destroy: true };
        await expect(client.verifySession()).rejects.toMatchObject({ kind: 'indeterminate' });
        // tokens untouched — we could not ask
        expect(await client.getAccessToken()).toBeTruthy();
    });

    it('definitive 401 (autoRefresh off) returns { valid: false }', async () => {
        const client = await seededClient({ autoRefresh: false });
        verifyCtl = { status: 401 };
        await expect(client.verifySession()).resolves.toMatchObject({ valid: false });
    });

    it('401 access token but a live refresh recovers → { valid: true }', async () => {
        const client = await seededClient(); // autoRefresh on
        // Simulate the client's access token having expired server-side: the
        // server now accepts a different token, so the client's stored one 401s.
        validToken = mintToken();
        // verify(401) → refresh(ok, rotates validToken) → verify(200)
        await expect(client.verifySession()).resolves.toMatchObject({ valid: true });
        expect(client.getIsAuthenticated()).toBe(true);
    });

    it('401 access token AND a rejected refresh → { valid: false } and cleared', async () => {
        const client = await seededClient();
        validToken = mintToken(); // client token now stale → verify 401
        refreshCtl = { status: 401 }; // refresh also rejected → session truly dead
        await expect(client.verifySession()).resolves.toMatchObject({ valid: false });
        expect(await client.getAccessToken()).toBeNull();
    });

    it('401 access token but an INDETERMINATE refresh → THROWS (session preserved)', async () => {
        const client = await seededClient();
        validToken = mintToken(); // client token stale → verify 401
        refreshCtl = { status: 502 }; // refresh couldn't complete
        await expect(client.verifySession()).rejects.toMatchObject({ kind: 'indeterminate' });
        expect(await client.getAccessToken()).toBeTruthy(); // NOT destroyed
    });

    // Default-preserve: if the refresh SUCCEEDS (tokens stored) but a post-success
    // side effect throws a kind-LESS error (e.g. an onTokensSet listener rejects,
    // or a storage write fails), verifySession must NOT report the session invalid
    // — that would log the user out on a non-401/403 failure.
    it('401 + successful refresh whose tokensSet listener throws → THROWS, not { valid:false }', async () => {
        const client = await seededClient();
        client.onTokensSet(async () => { throw new Error('keychain write failed'); });
        validToken = mintToken(); // client token stale → verify 401
        // refreshCtl default = ok: refresh returns fresh tokens (stored before the
        // listener throws), so the failure is post-success and carries no kind.
        await expect(client.verifySession()).rejects.toBeTruthy();
        // The session was NOT ended: tokens survive and no logout was emitted.
        expect(await client.getAccessToken()).toBeTruthy();
        expect(logoutHits).toBe(0);
    });
});

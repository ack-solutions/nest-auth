// @vitest-environment happy-dom
/**
 * Regression for ack-solutions/nest-auth#8: `AuthProvider` kept the
 * PREVIOUS account's session data when its `client` prop changed — the
 * multi-account recipe switches accounts exactly that way.
 *
 * Three shapes of the bug, all pinned here:
 *   1. outage: switching while the API is down left A's `authenticated` status
 *      and A's permissions in place indefinitely (indeterminate verify kept the
 *      previous status, and nothing cleared `sessionData`);
 *   2. every switch rendered A's permissions until B's `/auth/me` answered;
 *   3. a slow `/auth/me` from A that resolved after the switch overwrote B.
 *
 * NO MOCKS — real `AuthClient`s talk to a real Node HTTP server standing in for
 * the backend; the provider is rendered with react-dom into happy-dom.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import React, { act, useContext } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AuthClient, MemoryStorage } from '@ackplus/nest-auth-client';
import { AuthProvider } from '../../src/context/auth-provider';
import { AuthContext } from '../../src/context/auth-context';
import { useHasPermission } from '../../src/hooks/use-has-role';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const USERS: Record<string, { id: string; email: string; permissions: string[] }> = {
    'tok-a': { id: 'user-a', email: 'a@test.local', permissions: ['x.manage'] },
    'tok-b': { id: 'user-b', email: 'b@test.local', permissions: [] },
};

let server: Server;
let baseUrl: string;
/** When true the backend answers 503 to everything but login (an outage). */
let apiDown = false;
/** Per-token delay (ms) before `/auth/me` answers. */
let meDelay: Record<string, number> = {};

beforeAll(async () => {
    server = createServer((req, res) => {
        // happy-dom's fetch enforces CORS like a browser, so answer it like a
        // cross-origin backend would.
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            return res.end();
        }
        const send = (status: number, body: unknown) => {
            res.statusCode = status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(body));
        };
        let raw = '';
        req.on('data', (c) => (raw += c));
        req.on('end', () => {
            if (req.method === 'POST' && req.url === '/auth/login') {
                const email = JSON.parse(raw || '{}')?.credentials?.email;
                const token = Object.keys(USERS).find((t) => USERS[t].email === email);
                return token
                    ? send(200, { accessToken: token, refreshToken: `refresh-${token}`, isRequiresMfa: false })
                    : send(401, { message: 'bad credentials' });
            }
            if (apiDown) return send(503, { message: 'unavailable' });
            const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
            const user = USERS[token];
            if (!user) return send(401, { message: 'unauthorized' });
            if (req.url === '/auth/verify-session') return send(200, { valid: true, userId: user.id });
            if (req.url === '/auth/me') {
                setTimeout(() => send(200, user), meDelay[token] ?? 0);
                return;
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

beforeEach(() => {
    apiDown = false;
    meDelay = {};
});

async function signedInClient(email: string): Promise<AuthClient> {
    const client = new AuthClient({ baseUrl, accessTokenType: 'header', storage: new MemoryStorage() } as any);
    await client.login({ providerName: 'email', credentials: { email, password: 'pw' } } as any);
    return client;
}

/** What the probe saw on each render: status, the user's email, and the permission check. */
type Frame = { status: string; email: string | null; canManage: boolean };

function renderSwitchable(initial: AuthClient) {
    const frames: Frame[] = [];
    const ctxRef: { current: any } = { current: null };

    function Probe() {
        const ctx = useContext(AuthContext);
        ctxRef.current = ctx;
        const canManage = useHasPermission('x.manage');
        frames.push({ status: ctx.status, email: ctx.sessionData?.email ?? null, canManage });
        return null;
    }

    const container = document.createElement('div');
    const root: Root = createRoot(container);
    const render = (client: AuthClient) =>
        act(async () => {
            root.render(React.createElement(AuthProvider, { client, children: React.createElement(Probe) }));
        });
    return { frames, ctxRef, render, unmount: () => act(async () => root.unmount()) };
}

const last = (frames: Frame[]) => frames[frames.length - 1];

/** Poll (inside act) until `predicate` holds, so the tests don't race a loaded machine. */
async function waitUntil(predicate: () => boolean, what: string, timeoutMs = 5_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!predicate()) {
        if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
        await act(() => new Promise<void>((r) => setTimeout(r, 20)));
    }
}
const isSignedInAs = (frames: Frame[], email: string) => () =>
    last(frames)?.status === 'authenticated' && last(frames)?.email === email;

describe('AuthProvider — a `client` change never shows the previous account', () => {
    it('switching during an outage fails closed: no permissions, not authenticated', async () => {
        const a = await signedInClient('a@test.local');
        const b = await signedInClient('b@test.local');
        const view = renderSwitchable(a);

        await view.render(a);
        await waitUntil(isSignedInAs(view.frames, 'a@test.local'), 'A signed in');
        expect(last(view.frames).canManage).toBe(true);

        apiDown = true;
        await view.render(b);
        // B's verify comes back indeterminate (503) and resolves 'loading'.
        await waitUntil(() => last(view.frames).status !== 'loading', "B's verify to settle");

        // Before the fix: { status: 'authenticated', email: 'a@test.local', canManage: true }, forever.
        expect(last(view.frames).canManage).toBe(false);
        expect(last(view.frames).email).toBeNull();
        expect(last(view.frames).status).not.toBe('authenticated');
        await view.unmount();
    });

    it("never renders A's permissions while B's /auth/me is in flight", async () => {
        const a = await signedInClient('a@test.local');
        const b = await signedInClient('b@test.local');
        const view = renderSwitchable(a);

        await view.render(a);
        await waitUntil(isSignedInAs(view.frames, 'a@test.local'), 'A signed in');
        expect(last(view.frames).canManage).toBe(true);

        meDelay = { 'tok-b': 100 };
        const switchedAt = view.frames.length;
        await view.render(b);
        await waitUntil(isSignedInAs(view.frames, 'b@test.local'), 'B signed in');

        const afterSwitch = view.frames.slice(switchedAt);
        expect(afterSwitch.length).toBeGreaterThan(0);
        expect(afterSwitch.every((f) => !f.canManage && f.email !== 'a@test.local')).toBe(true);
        expect(afterSwitch[0].status).toBe('loading');
        expect(last(view.frames)).toEqual({ status: 'authenticated', email: 'b@test.local', canManage: false });
        await view.unmount();
    });

    it("drops a slow /auth/me from the old client that resolves after the switch", async () => {
        const a = await signedInClient('a@test.local');
        const b = await signedInClient('b@test.local');
        const view = renderSwitchable(a);

        await view.render(a);
        await waitUntil(isSignedInAs(view.frames, 'a@test.local'), 'A signed in');

        // A re-fetch for A (as a token refresh triggers) that answers late:
        // well after B has loaded.
        meDelay = { 'tok-a': 1_000 };
        const staleFetch = view.ctxRef.current.getSessionData();
        await view.render(b);
        await waitUntil(isSignedInAs(view.frames, 'b@test.local'), 'B signed in');

        await act(async () => { await staleFetch; });
        // Before the fix A's late answer overwrote B: email a@, canManage true.
        expect(last(view.frames)).toEqual({ status: 'authenticated', email: 'b@test.local', canManage: false });
        await view.unmount();
    });
});

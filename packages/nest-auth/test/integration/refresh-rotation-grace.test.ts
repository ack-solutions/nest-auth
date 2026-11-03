/**
 * Regression for ack-solutions/nest-auth#14: a refresh whose REPLY is lost
 * signed the user out.
 *
 * The client sends refresh token A, the server rotates to B and answers, but
 * the answer never arrives (dropped mobile signal, client timeout, proxy cut).
 * The client still holds A and retries — which reuse detection treated as theft:
 * session revoked, 401. `session.refreshTokenReuse.graceSeconds` accepts that
 * one retry. Pinned here:
 *   - within the grace, A again → 200 with a fresh pair, session kept, a
 *     `refresh_token_grace_used` event and NO reuse event;
 *   - single use: A a third time is reuse; so is B (the pair whose reply was
 *     lost), since the retry records no previous token;
 *   - after the grace, A is reuse exactly as before;
 *   - `graceSeconds` unset → identical to the old behaviour.
 *
 * NO MOCKS — real app, real DB, real HTTP.
 */
import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { NestAuthEvents } from '../../src/lib/auth.constants';

const PASSWORD = 'StrongPassword!1';

async function signup(handle: TestAppHandle, email: string): Promise<string> {
    const res = await request(handle.httpServer).post('/auth/signup').send({ email, password: PASSWORD });
    expect(res.status).toBeLessThan(300);
    return res.body.refreshToken;
}

function refresh(handle: TestAppHandle, refreshToken: string) {
    return request(handle.httpServer).post('/auth/refresh-token').send({ refreshToken });
}

function bootWithGrace(graceSeconds?: number) {
    return bootTestApp({
        nestAuth: { session: { refreshTokenReuse: graceSeconds === undefined ? {} : { graceSeconds } } } as any,
    });
}

/** Count both events for the lifetime of the app. */
function recordEvents(handle: TestAppHandle) {
    const emitter = handle.get(EventEmitter2);
    const events = { reuse: [] as any[], grace: [] as any[] };
    emitter.on(NestAuthEvents.REFRESH_TOKEN_REUSE_DETECTED, (p: any) => events.reuse.push(p));
    emitter.on(NestAuthEvents.REFRESH_TOKEN_GRACE_USED, (p: any) => events.grace.push(p));
    return events;
}

describe('refreshTokenReuse.graceSeconds — a lost refresh reply', () => {
    let handle: TestAppHandle | undefined;
    afterEach(async () => {
        await handle?.close();
        handle = undefined;
    });

    it('accepts one retry with the replaced token inside the grace, and keeps the session', async () => {
        handle = await bootWithGrace(30);
        const events = recordEvents(handle);
        const a = await signup(handle, 'grace-retry@test.local');

        const first = await refresh(handle, a); // reply "lost": the client never sees B
        expect(first.status).toBeLessThan(300);
        const b = first.body.refreshToken as string;

        const retry = await refresh(handle, a);
        expect(retry.status, 'the retry with A is not reuse').toBeLessThan(300);
        const c = retry.body.refreshToken as string;
        expect(c).toBeTruthy();
        expect(c).not.toBe(b);
        expect(events.grace).toHaveLength(1);
        expect(events.grace[0].sessionId).toBeTruthy();
        expect(events.reuse).toHaveLength(0);

        // The session is alive: the new pair keeps rotating.
        const next = await refresh(handle, c);
        expect(next.status).toBeLessThan(300);
    });

    it('is single use: the same old token a second time is reuse and revokes', async () => {
        handle = await bootWithGrace(30);
        const events = recordEvents(handle);
        const a = await signup(handle, 'grace-once@test.local');

        await refresh(handle, a);
        const retry = await refresh(handle, a);
        expect(retry.status).toBeLessThan(300);
        const c = retry.body.refreshToken as string;

        const again = await refresh(handle, a);
        expect(again.status).toBe(401);
        expect(events.reuse).toHaveLength(1);
        expect(events.reuse[0].revoked).toBe(true);
        // Revoked: the current token is dead too.
        expect((await refresh(handle, c)).status).toBe(401);
    });

    it("the pair whose reply was lost doesn't work after the retry", async () => {
        handle = await bootWithGrace(30);
        const events = recordEvents(handle);
        const a = await signup(handle, 'grace-lost-pair@test.local');

        const first = await refresh(handle, a);
        const b = first.body.refreshToken as string;
        expect((await refresh(handle, a)).status).toBeLessThan(300);

        const lost = await refresh(handle, b);
        expect(lost.status).toBe(401);
        expect(events.reuse).toHaveLength(1);
    });

    it('after the grace, the old token is reuse exactly as before', async () => {
        handle = await bootWithGrace(1);
        const events = recordEvents(handle);
        const a = await signup(handle, 'grace-expired@test.local');

        const first = await refresh(handle, a);
        const b = first.body.refreshToken as string;
        await new Promise((r) => setTimeout(r, 1_200));

        const late = await refresh(handle, a);
        expect(late.status).toBe(401);
        expect(events.grace).toHaveLength(0);
        expect(events.reuse).toHaveLength(1);
        expect(events.reuse[0].revoked).toBe(true);
        expect((await refresh(handle, b)).status, 'session revoked').toBe(401);
    });

    it('default (graceSeconds unset): an immediate retry is reuse, as in 2.16', async () => {
        handle = await bootWithGrace(undefined);
        const events = recordEvents(handle);
        const a = await signup(handle, 'grace-off@test.local');

        const first = await refresh(handle, a);
        const b = first.body.refreshToken as string;

        expect((await refresh(handle, a)).status).toBe(401);
        expect(events.grace).toHaveLength(0);
        expect(events.reuse).toHaveLength(1);
        expect((await refresh(handle, b)).status).toBe(401);
    });

    it('graceSeconds does not loosen the check for an unrelated token', async () => {
        handle = await bootWithGrace(30);
        const events = recordEvents(handle);
        const a = await signup(handle, 'grace-unrelated@test.local');
        const other = await signup(handle, 'grace-unrelated-2@test.local');

        // A different session's valid token is fine for ITS session...
        expect((await refresh(handle, other)).status).toBeLessThan(300);
        // ...and rotating A twice in a row (no lost reply) still works.
        const b = (await refresh(handle, a)).body.refreshToken as string;
        expect((await refresh(handle, b)).status).toBeLessThan(300);
        expect(events.grace).toHaveLength(0);
        expect(events.reuse).toHaveLength(0);
    });
});

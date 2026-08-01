/**
 * Real (no-mock) tests for refresh-token rotation & reuse detection.
 *
 * Every refresh issues a NEW refresh token (unique `jti`) and the session stores
 * a hash of the current one. Presenting an already-rotated (old) token is
 * detected as REUSE: by default the whole session is revoked (kills the token
 * family — the OAuth 2.0 best practice) and a reuse event is emitted. An opt-out
 * keeps the older reject-only behavior.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { NestAuthEvents } from '../../src/lib/auth.constants';

const PASSWORD = 'StrongPassword!1';

async function signup(handle: TestAppHandle, email: string): Promise<{ accessToken: string; refreshToken: string }> {
    const res = await request(handle.httpServer).post('/auth/signup').send({ email, password: PASSWORD });
    expect(res.status).toBeLessThan(300);
    return res.body;
}

function refresh(handle: TestAppHandle, refreshToken: string) {
    return request(handle.httpServer).post('/auth/refresh-token').send({ refreshToken });
}

describe('Refresh-token rotation & reuse detection (default: revoke on reuse)', () => {
    let handle: TestAppHandle;
    beforeEach(async () => { handle = await bootTestApp(); });
    afterEach(async () => { if (handle) await handle.close(); });

    it('rotates the token; on reuse revokes the whole session and emits an event', async () => {
        const emitter = handle.get(EventEmitter2);
        let reuseEvent: any = null;
        emitter.on(NestAuthEvents.REFRESH_TOKEN_REUSE_DETECTED, (p: any) => { reuseEvent = p; });

        const { refreshToken: rt1 } = await signup(handle, 'rotate@test.local');

        // First refresh succeeds and returns a NEW refresh token.
        const r1 = await refresh(handle, rt1);
        expect(r1.status).toBeLessThan(300);
        const rt2 = r1.body.refreshToken as string;
        expect(rt2).toBeTruthy();
        expect(rt2).not.toBe(rt1);

        // Replaying the OLD token is reuse → rejected + session revoked + event.
        const replay = await refresh(handle, rt1);
        expect(replay.status).toBeGreaterThanOrEqual(400);
        expect(reuseEvent, 'reuse event should fire').toBeTruthy();
        expect(reuseEvent.revoked).toBe(true);

        // The token family is dead: even the CURRENT token no longer works.
        const afterRevoke = await refresh(handle, rt2);
        expect(afterRevoke.status).toBeGreaterThanOrEqual(400);
    });
});

describe('Refresh-token reuse — revokeSession: false (opt-out)', () => {
    let handle: TestAppHandle;
    beforeEach(async () => {
        handle = await bootTestApp({
            nestAuth: { session: { refreshTokenReuse: { revokeSession: false } } } as any,
        });
    });
    afterEach(async () => { if (handle) await handle.close(); });

    it('rejects the replayed token but keeps the session alive', async () => {
        const { refreshToken: rt1 } = await signup(handle, 'rotate-optout@test.local');

        const r1 = await refresh(handle, rt1);
        const rt2 = r1.body.refreshToken as string;
        expect(rt2).not.toBe(rt1);

        // Replaying the old token is still rejected...
        const replay = await refresh(handle, rt1);
        expect(replay.status).toBeGreaterThanOrEqual(400);

        // ...but with revoke disabled, the current token keeps working.
        const r2 = await refresh(handle, rt2);
        expect(r2.status).toBeLessThan(300);
        expect(r2.body.refreshToken).not.toBe(rt2);
    });
});

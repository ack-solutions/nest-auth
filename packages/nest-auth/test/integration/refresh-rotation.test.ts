/**
 * Real (no-mock) tests for refresh-token rotation & reuse detection.
 *
 * Every refresh issues a NEW refresh token (unique `jti`) and the session stores
 * a hash of the current one. Presenting an already-rotated (old) token is
 * rejected; the current token keeps working.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

const PASSWORD = 'StrongPassword!1';

describe('Refresh-token rotation & reuse detection', () => {
    let handle: TestAppHandle;

    beforeEach(async () => {
        handle = await bootTestApp();
    });

    afterEach(async () => {
        if (handle) await handle.close();
    });

    async function signup(email: string): Promise<{ accessToken: string; refreshToken: string }> {
        const res = await request(handle.httpServer)
            .post('/auth/signup')
            .send({ email, password: PASSWORD });
        expect(res.status).toBeLessThan(300);
        return res.body;
    }

    function refresh(refreshToken: string) {
        return request(handle.httpServer).post('/auth/refresh-token').send({ refreshToken });
    }

    it('rotates the token and rejects the replayed old one', async () => {
        const { refreshToken: rt1 } = await signup('rotate@test.local');

        // First refresh succeeds and returns a NEW, different refresh token.
        const r1 = await refresh(rt1);
        expect(r1.status).toBeLessThan(300);
        const rt2 = r1.body.refreshToken as string;
        expect(rt2).toBeTruthy();
        expect(rt2).not.toBe(rt1);

        // Replaying the OLD token is rejected (it was rotated).
        const replay = await refresh(rt1);
        expect(replay.status).toBeGreaterThanOrEqual(400);

        // The current token still works (and rotates again).
        const r2 = await refresh(rt2);
        expect(r2.status).toBeLessThan(300);
        expect(r2.body.refreshToken).not.toBe(rt2);
    });
});

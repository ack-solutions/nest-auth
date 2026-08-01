/**
 * Regression tests for email-verification gating (registration.requireVerifiedEmail).
 *
 * NO MOCKS. Real NestJS + real DB. A tiny guarded test controller stands in for a
 * consumer's protected route; the library's own /auth/me stays reachable while
 * unverified. The guard reloads emailVerifiedAt per request, so flipping it in the
 * DB (a real verification) lets the same token through.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Controller, Get } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { Auth } from '../../src/lib/core/decorators/auth.decorator';
import { NestAuthUser } from '../../src/lib/user/entities/user.entity';

@Controller('protected-ping')
class ProtectedPingController {
    @Get()
    @Auth()
    ping() {
        return { ok: true };
    }
}

const PW = 'VerifyGate!1';

describe('email-verification gating — requireVerifiedEmail: true', () => {
    let handle: TestAppHandle;
    beforeEach(async () => {
        handle = await bootTestApp({
            nestAuth: { registration: { requireVerifiedEmail: true } } as any,
            extraControllers: [ProtectedPingController],
        });
    });
    afterEach(async () => { await handle.close(); });

    it('blocks a guarded route while unverified, keeps exempt routes reachable, then works after verifying', async () => {
        const email = 'verify-gate@test.local';
        const signup = await request(handle.httpServer).post('/auth/signup').send({ email, password: PW });
        expect(signup.status).toBeLessThan(300);
        const token = signup.body.accessToken ?? signup.body.tokens?.accessToken;
        expect(token, 'signup should return a token').toBeTypeOf('string');

        // Guarded, non-exempt route → blocked.
        const blocked = await request(handle.httpServer).get('/protected-ping').set('Authorization', `Bearer ${token}`);
        expect(blocked.status).toBe(403);
        expect(JSON.stringify(blocked.body)).toContain('EMAIL_NOT_VERIFIED');

        // Exempt route (@SkipEmailVerification) stays reachable while unverified.
        const me = await request(handle.httpServer).get('/auth/me').set('Authorization', `Bearer ${token}`);
        expect(me.status).toBe(200);

        // Verify the email (the guard reloads emailVerifiedAt per request).
        await handle.get(DataSource).getRepository(NestAuthUser).update({ email }, { emailVerifiedAt: new Date() });

        // Same token now passes the gate.
        const afterVerify = await request(handle.httpServer).get('/protected-ping').set('Authorization', `Bearer ${token}`);
        expect(afterVerify.status, JSON.stringify(afterVerify.body)).toBe(200);
    });
});

describe('email-verification gating — disabled by default', () => {
    let handle: TestAppHandle;
    beforeEach(async () => {
        handle = await bootTestApp({ extraControllers: [ProtectedPingController] });
    });
    afterEach(async () => { await handle.close(); });

    it('does not gate an unverified user when requireVerifiedEmail is off', async () => {
        const email = 'no-gate@test.local';
        const signup = await request(handle.httpServer).post('/auth/signup').send({ email, password: PW });
        const token = signup.body.accessToken ?? signup.body.tokens?.accessToken;

        const res = await request(handle.httpServer).get('/protected-ping').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
    });
});

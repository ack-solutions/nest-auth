/**
 * Regression for ack-solutions/nest-auth#11: app-defined rate-limit buckets.
 *
 * `@RateLimit` used to accept only the eight built-in bucket names, so an app's
 * own public route had to borrow one and silently share its counter with the
 * built-in route. Worse, a name outside the union (via a cast) resolved to no
 * config at all and the route went UNTHROTTLED with no error. Now:
 *   - `security.rateLimit.buckets` can declare new buckets, each with its own
 *     counter, and `@RateLimit('<name>')` accepts them;
 *   - a `@RateLimit` naming a bucket that is neither built-in nor configured
 *     fails at boot, whether or not rate limiting is enabled.
 *
 * NO MOCKS — real app, real guard wiring, real HTTP.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Controller, Get } from '@nestjs/common';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { RateLimit } from '../../src/lib/core/decorators/rate-limit.decorator';

const LOOKUP_MAX = 3;
const LOGIN_MAX = 5;

@Controller('custom-limited')
class CustomBucketController {
    @Get('lookup')
    @RateLimit('lookup')
    lookup() {
        return { ok: true };
    }

    // Shares a built-in name: proves app routes can still opt into one on purpose.
    @Get('as-login')
    @RateLimit('login')
    asLogin() {
        return { ok: true };
    }
}

@Controller('typo-limited')
class TypoBucketController {
    @Get('go')
    @RateLimit('lokup')
    go() {
        return { ok: true };
    }
}

describe('@RateLimit — app-defined buckets', () => {
    let handle: TestAppHandle;

    beforeAll(async () => {
        handle = await bootTestApp({
            extraControllers: [CustomBucketController],
            nestAuth: {
                security: {
                    rateLimit: {
                        enabled: true,
                        keyBy: 'ip',
                        buckets: {
                            lookup: { windowMs: 60_000, max: LOOKUP_MAX },
                            login: { max: LOGIN_MAX }, // partial override of a built-in keeps its window
                        },
                    },
                } as any,
            },
        });
    }, 60_000);

    afterAll(async () => {
        await handle?.close();
    });

    it(`an app-defined bucket enforces its own max (${LOOKUP_MAX})`, async () => {
        for (let i = 1; i <= LOOKUP_MAX; i++) {
            expect((await request(handle.httpServer).get('/custom-limited/lookup')).status, `request ${i}`).toBe(200);
        }
        const over = await request(handle.httpServer).get('/custom-limited/lookup');
        expect(over.status).toBe(429);
        expect(over.headers['retry-after']).toBeTruthy();
    });

    it("has its own counter: exhausting 'lookup' leaves 'login' untouched", async () => {
        for (let i = 1; i <= LOGIN_MAX; i++) {
            expect((await request(handle.httpServer).get('/custom-limited/as-login')).status, `request ${i}`).toBe(200);
        }
        expect((await request(handle.httpServer).get('/custom-limited/as-login')).status).toBe(429);
    });
});

describe('@RateLimit — an undefined bucket fails at boot', () => {
    it('rejects a typo even when rate limiting is disabled', async () => {
        await expect(
            bootTestApp({ extraControllers: [TypoBucketController], nestAuth: {} }),
        ).rejects.toThrow(/undefined bucket\(s\): 'lokup'/);
    }, 60_000);

    it('rejects an app-defined bucket missing windowMs/max', async () => {
        await expect(
            bootTestApp({
                extraControllers: [TypoBucketController],
                nestAuth: { security: { rateLimit: { buckets: { lokup: { max: 3 } } } } as any },
            }),
        ).rejects.toThrow(/'lokup'/);
    }, 60_000);

    it('boots when the bucket is declared', async () => {
        const handle = await bootTestApp({
            extraControllers: [TypoBucketController],
            nestAuth: { security: { rateLimit: { buckets: { lokup: { windowMs: 1_000, max: 3 } } } } as any },
        });
        expect((await request(handle.httpServer).get('/typo-limited/go')).status).toBe(200);
        await handle.close();
    }, 60_000);
});

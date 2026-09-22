/**
 * Regression: registering RateLimitGuard twice must not double-count.
 *
 * `@RateLimit(bucket)` already carries `UseGuards(RateLimitGuard)`. Naming the
 * guard AGAIN in a controller's own `@UseGuards(...)` made Nest run it twice
 * per request, so every bucket increment happened twice and each configured
 * limit silently became half of what it said — no error, no warning, just 429s
 * arriving early. (Both of the reporter's public controllers did this, because
 * the guard is documented as opt-in, which reads as "the controller must apply
 * it".) The guard now stamps the request per bucket, so duplicate registration
 * counts once. NO MOCKS — real app, real guard wiring, real HTTP.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Controller, Get, UseGuards } from '@nestjs/common';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { RateLimit } from '../../src/lib/core/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../src/lib/core/guards/rate-limit.guard';

const MAX = 4;

/** The reporter's shape: @RateLimit AND the guard named again at class level. */
@Controller('dup-limited')
@UseGuards(RateLimitGuard)
class DuplicatedGuardController {
    @Get('go')
    @RateLimit('signup')
    go() {
        return { ok: true };
    }
}

/** Control: the documented usage — @RateLimit alone. */
@Controller('single-limited')
class SingleGuardController {
    @Get('go')
    @RateLimit('login')
    go() {
        return { ok: true };
    }
}

describe('RateLimitGuard — duplicate registration cannot halve the limit', () => {
    let handle: TestAppHandle;

    beforeAll(async () => {
        handle = await bootTestApp({
            extraControllers: [DuplicatedGuardController, SingleGuardController],
            nestAuth: {
                security: {
                    rateLimit: {
                        enabled: true,
                        keyBy: 'ip',
                        buckets: {
                            signup: { windowMs: 60_000, max: MAX },
                            login: { windowMs: 60_000, max: MAX },
                        },
                    },
                } as any,
            },
        });
    }, 60_000);

    afterAll(async () => {
        await handle?.close();
    });

    it(`duplicated guard: all ${MAX} configured requests pass, ${MAX + 1}th → 429 (was: 429 at ${MAX / 2 + 1})`, async () => {
        for (let i = 1; i <= MAX; i++) {
            const res = await request(handle.httpServer).get('/dup-limited/go');
            expect(res.status, `request ${i} of ${MAX} should pass`).toBe(200);
        }
        const over = await request(handle.httpServer).get('/dup-limited/go');
        expect(over.status).toBe(429);
        expect(over.headers['retry-after']).toBeTruthy();
    });

    it('single registration still enforces the same limit (no under-counting)', async () => {
        for (let i = 1; i <= MAX; i++) {
            const res = await request(handle.httpServer).get('/single-limited/go');
            expect(res.status, `request ${i} of ${MAX} should pass`).toBe(200);
        }
        expect((await request(handle.httpServer).get('/single-limited/go')).status).toBe(429);
    });
});

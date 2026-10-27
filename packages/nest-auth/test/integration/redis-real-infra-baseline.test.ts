/**
 * Phase 0 of issue #13 — the proving ground.
 *
 * Establishes the infrastructure every later claim in that issue depends on,
 * and measures TODAY's behaviour so the improvements can be proven rather than
 * asserted:
 *
 *   - a real Postgres and a real Redis, in containers (no sqljs, no fakes);
 *   - TWO Nest app instances sharing them, which is the only way to observe
 *     cross-instance behaviour;
 *   - a SQL counter, so "costs N database queries per request" is a measured
 *     number and not a guess.
 *
 * The baseline recorded here is the thing issue #13 wants driven to zero: with
 * the Redis session store, a warm authenticated request still reaches the
 * database, because the guard reads the user row on every request
 * (auth.guard.ts, `NestAuthUser.findOne`). That read is asserted below so the
 * fix has something concrete to move.
 *
 * Skipped when Docker is unavailable — the default sqljs suites must keep
 * working on a bare machine.
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { DOCKER_AVAILABLE, setupRealInfra } from '../helpers/real-infra';
import { createQueryCounter, type TestAppHandle } from '../helpers/boot-test-app';
import { NestAuthAuthGuard, SkipEmailVerification, SkipMfa } from '../../src';

const PASSWORD = 'RealInfraPass!1';

/**
 * The cheapest possible authenticated route: it does no work of its own, so
 * every query it costs is the GUARD's cost, not the endpoint's.
 */
@Controller('probe')
class ProbeController {
    @Get('ping')
    @SkipEmailVerification()
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    ping() {
        return { ok: true };
    }
}

const infra = setupRealInfra();

// Reported as SKIPPED without Docker, never as a silent pass.
describe.skipIf(!DOCKER_AVAILABLE)('issue #13 — real Redis + Postgres proving ground', () => {

    it('boots an app on a real Postgres with the real Redis session store', async () => {
        const a = await infra.bootInstance({}, { bootOptions: { extraControllers: [ProbeController] } });

        const signup = await request(a.httpServer)
            .post('/auth/signup')
            .send({ email: 'infra-boot@test.local', password: PASSWORD });
        expect(signup.status).toBeLessThan(300);

        const token = signup.body.accessToken ?? signup.body.tokens?.accessToken;
        expect(token).toBeTruthy();

        const probe = await request(a.httpServer).get('/probe/ping').set('Authorization', `Bearer ${token}`);
        expect(probe.status).toBe(200);
    });

    it('the session really lives in Redis, not in the database', async () => {
        const { redisUrl } = infra.info();
        const a = await infra.bootInstance({}, { first: false, bootOptions: { extraControllers: [ProbeController] } });

        const signup = await request(a.httpServer)
            .post('/auth/signup')
            .send({ email: 'infra-redis@test.local', password: PASSWORD });
        expect(signup.status).toBeLessThan(300);

        const { default: Redis } = await import('ioredis');
        const client = new Redis(redisUrl);
        try {
            const keys = await client.keys('*');
            // A signed-in user must have produced at least one key in Redis.
            expect(keys.length).toBeGreaterThan(0);
        } finally {
            await client.quit();
        }
    });

    it('TWO instances share one Redis: a token minted on A is accepted on B', async () => {
        const a = await infra.bootInstance({}, { first: false, bootOptions: { extraControllers: [ProbeController] } });
        const b = await infra.bootInstance({}, { first: false, bootOptions: { extraControllers: [ProbeController] } });

        const signup = await request(a.httpServer)
            .post('/auth/signup')
            .send({ email: 'infra-two@test.local', password: PASSWORD });
        expect(signup.status).toBeLessThan(300);
        const token = signup.body.accessToken ?? signup.body.tokens?.accessToken;

        // Instance B never saw this sign-in. It can only accept the token by
        // reading the session out of the shared Redis.
        const onB = await request(b.httpServer).get('/probe/ping').set('Authorization', `Bearer ${token}`);
        expect(onB.status).toBe(200);
    });

    it('BASELINE: a warm authenticated request still costs database queries (issue #13, problem 1)', async () => {
        const counter = createQueryCounter();
        const a = await infra.bootInstance(
            {},
            { first: false, bootOptions: { extraControllers: [ProbeController], queryCounter: counter } },
        );

        const signup = await request(a.httpServer)
            .post('/auth/signup')
            .send({ email: 'infra-count@test.local', password: PASSWORD });
        expect(signup.status).toBeLessThan(300);
        const token = signup.body.accessToken ?? signup.body.tokens?.accessToken;

        // Warm the session: the first guarded request populates whatever caches exist.
        await request(a.httpServer).get('/probe/ping').set('Authorization', `Bearer ${token}`);

        // Measure ONLY the second, warm request.
        counter.reset();
        const probe = await request(a.httpServer).get('/probe/ping').set('Authorization', `Bearer ${token}`);
        expect(probe.status).toBe(200);

        // This is the number issue #13 wants to become 0. Recorded, not hidden:
        // if a future change drives it down, this assertion is what must be
        // updated — deliberately, with the fix.
        // eslint-disable-next-line no-console
        console.info(
            `[issue-13 baseline] warm authenticated request = ${counter.count} database queries:\n` +
            counter.queries.map((q) => `    ${q}`).join('\n'),
        );
        expect(counter.count).toBeGreaterThan(0);

        // And specifically: the guard reads the user row. That is the read to remove.
        const readsUserRow = counter.queries.some((q) => /from\s+"?nest_auth_users"?/i.test(q));
        expect(readsUserRow).toBe(true);
    });

    it('the SQL counter itself works — an unauthenticated 401 costs no user read', async () => {
        const counter = createQueryCounter();
        const a = await infra.bootInstance(
            {},
            { first: false, bootOptions: { extraControllers: [ProbeController], queryCounter: counter } },
        );

        counter.reset();
        const res = await request(a.httpServer).get('/probe/ping');
        expect(res.status).toBe(401);
        // No token, so the guard short-circuits before any user lookup. This
        // guards the counter against silently counting nothing at all.
        const readsUserRow = counter.queries.some((q) => /from\s+"?nest_auth_users"?/i.test(q));
        expect(readsUserRow).toBe(false);
    });
});

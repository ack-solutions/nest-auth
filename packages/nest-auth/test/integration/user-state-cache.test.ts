/**
 * Issue #13, problem 1 — the user-state cache, and the invalidation that makes
 * it safe.
 *
 * The performance claim is cheap to make and cheap to test: a warm
 * authenticated request now costs no database query (asserted in
 * `redis-real-infra-baseline.test.ts`). The DANGEROUS half is this one. Caching
 * `isActive` turns a stale entry into an authentication bypass: a deactivated
 * account would keep working until the entry expired.
 *
 * So every write path is exercised here against a real Postgres and a real
 * Redis, with two app instances where it matters:
 *
 *   1. a write through the ORM (`repository.save()`), which is what the admin
 *      console and UserService both end up doing — the TypeORM subscriber must
 *      drop the entry;
 *   2. the same write seen from ANOTHER instance, which only works because the
 *      cache is shared;
 *   3. account deletion, which must never be served from cache;
 *   4. a bulk `UPDATE` that bypasses ORM subscribers — proving the documented
 *      limitation really is the limitation, and that `invalidateUser()` fixes
 *      it;
 *   5. caching turned off, which must restore the per-request database read;
 *   6. the per-process default, which must be OFF so a multi-instance
 *      deployment is not silently given a staleness window.
 *
 * Skipped without Docker.
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DOCKER_AVAILABLE, setupRealInfra } from '../helpers/real-infra';
import { bootTestApp, createQueryCounter, type TestAppHandle } from '../helpers/boot-test-app';
import {
    NestAuthAuthGuard,
    NestAuthCacheService,
    NestAuthUser,
    NestAuthEvents,
    SkipEmailVerification,
    SkipMfa,
    SkipMustChangePassword,
} from '../../src';
import { SESSION_STORE } from '../../src/lib/session/services/session-manager.service';

const PASSWORD = 'UserStateCache!1';

@Controller('probe')
class ProbeController {
    @Get('ping')
    @SkipEmailVerification()
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    ping() {
        return { ok: true };
    }

    /**
     * Echoes the flags the guard derives from the cached user state, so a test
     * can see the state itself rather than only its side effects. Skips the
     * enforcement decorators so the route stays reachable either way.
     */
    @Get('state')
    @SkipEmailVerification()
    @SkipMfa()
    @SkipMustChangePassword()
    @UseGuards(NestAuthAuthGuard)
    state(@Req() req: any) {
        return {
            mustChangePassword: req.mustChangePassword === true,
            emailVerified: req.emailVerified === true,
        };
    }
}

const infra = setupRealInfra();

/** Sign up and return a warmed token — the cache is populated on first use. */
async function signUpAndWarm(handle: TestAppHandle, email: string): Promise<string> {
    const signup = await request(handle.httpServer)
        .post('/auth/signup')
        .send({ email, password: PASSWORD });
    expect(signup.status).toBeLessThan(300);
    const token = signup.body.accessToken ?? signup.body.tokens?.accessToken;
    expect(token).toBeTruthy();

    const warm = await request(handle.httpServer).get('/probe/ping').set('Authorization', `Bearer ${token}`);
    expect(warm.status).toBe(200);
    return token;
}

function userRepo(handle: TestAppHandle): Repository<NestAuthUser> {
    return handle.get<Repository<NestAuthUser>>(getRepositoryToken(NestAuthUser));
}

describe.skipIf(!DOCKER_AVAILABLE)('issue #13 p1 — user-state cache invalidation', () => {

    it('an ORM write deactivating the account is refused on the NEXT request', async () => {
        const a = await infra.bootInstance({}, { bootOptions: { extraControllers: [ProbeController] } });
        const token = await signUpAndWarm(a, 'cache-deactivate@test.local');

        const repo = userRepo(a);
        const user = await repo.findOne({ where: { email: 'cache-deactivate@test.local' } });
        expect(user).toBeTruthy();

        // A bare entity save — exactly what the admin console does. It does NOT
        // go through UserService, so nothing but the subscriber can catch it.
        user!.isActive = false;
        await repo.save(user!);

        const after = await request(a.httpServer).get('/probe/ping').set('Authorization', `Bearer ${token}`);
        expect(after.status).toBe(401);
    });

    it('mustChangePassword set by an ORM write is visible on the next request', async () => {
        const a = await infra.bootInstance({}, { first: false, bootOptions: { extraControllers: [ProbeController] } });
        const token = await signUpAndWarm(a, 'cache-mcp@test.local');

        const before = await request(a.httpServer).get('/probe/state').set('Authorization', `Bearer ${token}`);
        expect(before.status).toBe(200);
        expect(before.body.mustChangePassword).toBe(false);

        const repo = userRepo(a);
        const user = await repo.findOne({ where: { email: 'cache-mcp@test.local' } });
        user!.mustChangePassword = true;
        await repo.save(user!);

        const after = await request(a.httpServer).get('/probe/state').set('Authorization', `Bearer ${token}`);
        expect(after.status).toBe(200);
        expect(after.body.mustChangePassword).toBe(true);
    });

    it('emailVerifiedAt changed by an ORM write is visible on the next request', async () => {
        const a = await infra.bootInstance({}, { first: false, bootOptions: { extraControllers: [ProbeController] } });
        const token = await signUpAndWarm(a, 'cache-verify@test.local');

        const repo = userRepo(a);
        const user = await repo.findOne({ where: { email: 'cache-verify@test.local' } });
        const wasVerified = !!user!.emailVerifiedAt;

        user!.emailVerifiedAt = wasVerified ? null as any : new Date();
        await repo.save(user!);

        const after = await request(a.httpServer).get('/probe/state').set('Authorization', `Bearer ${token}`);
        expect(after.status).toBe(200);
        expect(after.body.emailVerified).toBe(!wasVerified);
    });

    it('a deleted account is refused — a missing user is never served from cache', async () => {
        const a = await infra.bootInstance({}, { first: false, bootOptions: { extraControllers: [ProbeController] } });
        const token = await signUpAndWarm(a, 'cache-deleted@test.local');

        const repo = userRepo(a);
        const user = await repo.findOne({ where: { email: 'cache-deleted@test.local' } });

        // Remove the row out from under the live session. The session itself
        // still exists in Redis, so only the user lookup can catch this.
        await repo.remove(user!);

        const after = await request(a.httpServer).get('/probe/ping').set('Authorization', `Bearer ${token}`);
        expect(after.status).toBe(401);
    });

    it('TWO instances: a deactivation on A is enforced by B on the next request', async () => {
        const a = await infra.bootInstance({}, { first: false, bootOptions: { extraControllers: [ProbeController] } });
        const b = await infra.bootInstance({}, { first: false, bootOptions: { extraControllers: [ProbeController] } });

        const token = await signUpAndWarm(a, 'cache-cross@test.local');

        // Warm B's view of the same account too, so B genuinely holds a cached
        // entry that has to be invalidated rather than simply being absent.
        const onB = await request(b.httpServer).get('/probe/ping').set('Authorization', `Bearer ${token}`);
        expect(onB.status).toBe(200);

        const repo = userRepo(a);
        const user = await repo.findOne({ where: { email: 'cache-cross@test.local' } });
        user!.isActive = false;
        await repo.save(user!);

        // B never saw the write. It can only refuse because the invalidation
        // went to the SHARED cache.
        const afterOnB = await request(b.httpServer).get('/probe/ping').set('Authorization', `Bearer ${token}`);
        expect(afterOnB.status).toBe(401);
    });

    it('a bulk UPDATE bypasses the subscriber — invalidateUser() is the documented fix', async () => {
        const a = await infra.bootInstance({}, { first: false, bootOptions: { extraControllers: [ProbeController] } });
        const token = await signUpAndWarm(a, 'cache-bulk@test.local');

        const repo = userRepo(a);
        const user = await repo.findOne({ where: { email: 'cache-bulk@test.local' } });

        // `repository.update()` compiles to a bare UPDATE statement. TypeORM
        // runs NO entity subscriber for it — the same blind spot as raw SQL or
        // a migration.
        await repo.update({ id: user!.id }, { isActive: false });

        // So the request still succeeds. This is the library's documented
        // limitation, asserted rather than left as a footnote: if a future
        // change makes TypeORM fire subscribers here, this test turns red and
        // the docs need updating.
        const stale = await request(a.httpServer).get('/probe/ping').set('Authorization', `Bearer ${token}`);
        expect(stale.status).toBe(200);

        // The escape hatch, and the event it emits.
        const cache = a.get<NestAuthCacheService>(NestAuthCacheService);
        const emitter = a.get<EventEmitter2>(EventEmitter2);
        const seen: string[] = [];
        emitter.on(NestAuthEvents.USER_STATE_INVALIDATED, (p: any) => seen.push(p?.userId));

        await cache.invalidateUser(user!.id);
        expect(seen).toContain(user!.id);

        const after = await request(a.httpServer).get('/probe/ping').set('Authorization', `Bearer ${token}`);
        expect(after.status).toBe(401);
    });

    it('userStateCache.enabled: false restores the per-request database read', async () => {
        const counter = createQueryCounter();
        const a = await infra.bootInstance(
            { session: { userStateCache: { enabled: false } } } as any,
            { first: false, bootOptions: { extraControllers: [ProbeController], queryCounter: counter } },
        );
        const token = await signUpAndWarm(a, 'cache-off@test.local');

        counter.reset();
        const probe = await request(a.httpServer).get('/probe/ping').set('Authorization', `Bearer ${token}`);
        expect(probe.status).toBe(200);

        // Opting out must really opt out: the guard reads the user row again.
        const readsUserRow = counter.queries.some((q) => /from\s+"?nest_auth_users"?/i.test(q));
        expect(readsUserRow).toBe(true);
    });

    it('the library closes a Redis client it opened, and the cache rides that same connection', async () => {
        const a = await infra.bootInstance({}, { first: false, bootOptions: { extraControllers: [ProbeController] } });

        const store = a.get<any>(SESSION_STORE);
        const client = store.getClient();
        expect(client).toBeTruthy();

        const cache = a.get<NestAuthCacheService>(NestAuthCacheService);
        // Redis store ⇒ the cache is the shared one, and on by default.
        expect(cache.distributed).toBe(true);
        expect(cache.enabled).toBe(true);

        await infra.closeInstance(a);

        // The library opened this connection, so the library must close it.
        // Left open, each app instance leaked a socket that ioredis kept
        // reconnecting — visible as ECONNRESET noise on teardown.
        expect(client.status).toBe('end');
    });
});

describe.skipIf(!DOCKER_AVAILABLE)('issue #13 p1 — the per-process default is OFF', () => {
    it('with the DATABASE session store, caching is off unless asked for', async () => {
        const { postgresUrl } = infra.info();
        const counter = createQueryCounter();

        const handle = await bootTestApp({
            database: { driver: 'postgres', url: postgresUrl },
            dropSchema: false,
            synchronize: true,
            extraControllers: [ProbeController],
            queryCounter: counter,
            nestAuth: { session: { storageType: 'database' } } as any,
        });

        try {
            const token = await signUpAndWarm(handle, 'cache-dbstore@test.local');

            const cache = handle.get<NestAuthCacheService>(NestAuthCacheService);
            // No shared cache here, so an invalidation could not reach another
            // instance. Defaulting to ON would hand a multi-instance
            // deployment a silent staleness window on `isActive`.
            expect(cache.distributed).toBe(false);
            expect(cache.enabled).toBe(false);

            counter.reset();
            const probe = await request(handle.httpServer).get('/probe/ping').set('Authorization', `Bearer ${token}`);
            expect(probe.status).toBe(200);
            const readsUserRow = counter.queries.some((q) => /from\s+"?nest_auth_users"?/i.test(q));
            expect(readsUserRow).toBe(true);
        } finally {
            await handle.close();
        }
    });

    it('opting in on a per-process store works, and invalidation still holds locally', async () => {
        const { postgresUrl } = infra.info();
        const counter = createQueryCounter();

        const handle = await bootTestApp({
            database: { driver: 'postgres', url: postgresUrl },
            dropSchema: false,
            synchronize: true,
            extraControllers: [ProbeController],
            queryCounter: counter,
            nestAuth: {
                session: { storageType: 'database', userStateCache: { enabled: true, ttlSeconds: 60 } },
            } as any,
        });

        try {
            const token = await signUpAndWarm(handle, 'cache-dbstore-on@test.local');

            const cache = handle.get<NestAuthCacheService>(NestAuthCacheService);
            expect(cache.enabled).toBe(true);
            expect(cache.ttlSeconds).toBe(60);

            counter.reset();
            await request(handle.httpServer).get('/probe/ping').set('Authorization', `Bearer ${token}`);
            const readsUserRow = counter.queries.some((q) => /from\s+"?nest_auth_users"?/i.test(q));
            expect(readsUserRow).toBe(false);

            // Within one process the subscriber still invalidates correctly.
            const repo = userRepo(handle);
            const user = await repo.findOne({ where: { email: 'cache-dbstore-on@test.local' } });
            user!.isActive = false;
            await repo.save(user!);

            const after = await request(handle.httpServer).get('/probe/ping').set('Authorization', `Bearer ${token}`);
            expect(after.status).toBe(401);
        } finally {
            await handle.close();
        }
    });
});

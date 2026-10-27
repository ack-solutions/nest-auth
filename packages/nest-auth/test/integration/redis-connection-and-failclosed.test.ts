/**
 * Issue #13, problem 4 — the Redis connection.
 *
 * Two things are proven here against a REAL Redis:
 *
 * 1. An app can hand the library an existing ioredis client, so one connection
 *    pool and one configuration (TLS, password, sentinel) serve the whole app
 *    instead of the library opening a second connection of its own. The
 *    library must not own that client's lifecycle.
 *
 * 2. When Redis is unreachable the guard fails CLOSED, on EVERY route.
 *
 *    This was a real fail-open. `findById` rethrew a plain Error, and the
 *    guard's catch treated any error on an optional-auth route as "no
 *    session": it reset the request to anonymous and returned, letting the
 *    call through. A Redis outage therefore silently opened every optional
 *    route. Now the store raises SessionStoreUnavailableError and the guard
 *    rethrows it before the optional-auth branch, so the request is refused
 *    with 503 SESSION_STORE_UNAVAILABLE.
 *
 *    503 rather than 401 is deliberate: a 401 tells every client to sign the
 *    user out, so a brief Redis blip would log out the whole user base. 503
 *    says "retry".
 *
 * Skipped without Docker.
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { DOCKER_AVAILABLE, setupRealInfra } from '../helpers/real-infra';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { Auth, NestAuthAuthGuard, SkipEmailVerification, SkipMfa, ERROR_CODES } from '../../src';

const PASSWORD = 'RedisConnPass!1';

@Controller('probe')
class ProbeController {
    /** Auth REQUIRED. */
    @Get('strict')
    @SkipEmailVerification()
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    strict() {
        return { ok: true };
    }

    /**
     * Auth OPTIONAL — the route that used to be let through during an outage.
     */
    @Get('optional')
    @SkipEmailVerification()
    @SkipMfa()
    @Auth(true)
    optional() {
        return { ok: true };
    }
}

const infra = setupRealInfra();

describe.skipIf(!DOCKER_AVAILABLE)('issue #13 p4 — Redis connection and fail-closed', () => {
    it('accepts an existing ioredis client instead of opening its own', async () => {
        const { postgresUrl, redisUrl } = infra.info();
        const { default: Redis } = await import('ioredis');

        // The app's own connection, created and owned by the app.
        const appClient = new Redis(redisUrl);
        let handle: TestAppHandle | null = null;
        try {
            handle = await bootTestApp({
                database: { driver: 'postgres', url: postgresUrl },
                // Containers are fresh per suite: create the schema (idempotent),
                // but never drop it — later boots in this file share the database.
                dropSchema: false,
                synchronize: true,
                extraControllers: [ProbeController],
                nestAuth: {
                    session: {
                        storageType: 'redis',
                        redis: { client: appClient, keyPrefix: 'shared-client:' },
                    },
                } as any,
            });

            const signup = await request(handle.httpServer)
                .post('/auth/signup')
                .send({ email: 'shared-client@test.local', password: PASSWORD });
            expect(signup.status).toBeLessThan(300);
            const token = signup.body.accessToken ?? signup.body.tokens?.accessToken;

            const probe = await request(handle.httpServer)
                .get('/probe/strict')
                .set('Authorization', `Bearer ${token}`);
            expect(probe.status).toBe(200);

            // The session landed under OUR prefix, through OUR client.
            const keys = await appClient.keys('shared-client:*');
            expect(keys.length).toBeGreaterThan(0);

            // The library must not have closed the app's client.
            await handle.close();
            handle = null;
            expect(appClient.status).not.toBe('end');
            await expect(appClient.ping()).resolves.toBe('PONG');
        } finally {
            if (handle) await handle.close();
            await appClient.quit().catch(() => undefined);
        }
    });

    it('fails CLOSED when Redis is unreachable — required auth returns 503, not 401', async () => {
        const { postgresUrl, redisUrl } = infra.info();
        const { default: Redis } = await import('ioredis');

        const appClient = new Redis(redisUrl, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
        let handle: TestAppHandle | null = null;
        try {
            handle = await bootTestApp({
                database: { driver: 'postgres', url: postgresUrl },
                // Containers are fresh per suite: create the schema (idempotent),
                // but never drop it — later boots in this file share the database.
                dropSchema: false,
                synchronize: true,
                extraControllers: [ProbeController],
                nestAuth: {
                    session: {
                        storageType: 'redis',
                        redis: { client: appClient, keyPrefix: 'failclosed:' },
                    },
                } as any,
            });

            const signup = await request(handle.httpServer)
                .post('/auth/signup')
                .send({ email: 'failclosed@test.local', password: PASSWORD });
            expect(signup.status).toBeLessThan(300);
            const token = signup.body.accessToken ?? signup.body.tokens?.accessToken;

            // Works while Redis is up.
            const before = await request(handle.httpServer)
                .get('/probe/strict')
                .set('Authorization', `Bearer ${token}`);
            expect(before.status).toBe(200);

            // Take Redis away from the app.
            appClient.disconnect();

            const during = await request(handle.httpServer)
                .get('/probe/strict')
                .set('Authorization', `Bearer ${token}`);
            expect(during.status).toBe(503);
            expect(during.body?.code ?? during.body?.message?.code).toBe(
                ERROR_CODES.SESSION_STORE_UNAVAILABLE,
            );
        } finally {
            if (handle) await handle.close();
            appClient.disconnect();
        }
    });

    it('fails CLOSED on an OPTIONAL-auth route too — the outage must not pass as anonymous', async () => {
        const { postgresUrl, redisUrl } = infra.info();
        const { default: Redis } = await import('ioredis');

        const appClient = new Redis(redisUrl, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
        let handle: TestAppHandle | null = null;
        try {
            handle = await bootTestApp({
                database: { driver: 'postgres', url: postgresUrl },
                // Containers are fresh per suite: create the schema (idempotent),
                // but never drop it — later boots in this file share the database.
                dropSchema: false,
                synchronize: true,
                extraControllers: [ProbeController],
                nestAuth: {
                    session: {
                        storageType: 'redis',
                        redis: { client: appClient, keyPrefix: 'failclosed-opt:' },
                    },
                } as any,
            });

            const signup = await request(handle.httpServer)
                .post('/auth/signup')
                .send({ email: 'failclosed-opt@test.local', password: PASSWORD });
            expect(signup.status).toBeLessThan(300);
            const token = signup.body.accessToken ?? signup.body.tokens?.accessToken;

            // A caller with NO token is still welcome on an optional route.
            const anon = await request(handle.httpServer).get('/probe/optional');
            expect(anon.status).toBe(200);

            appClient.disconnect();

            // A caller WITH a token, during an outage, must NOT be quietly
            // downgraded to anonymous and let through. That is the fail-open.
            const during = await request(handle.httpServer)
                .get('/probe/optional')
                .set('Authorization', `Bearer ${token}`);
            expect(during.status).toBe(503);
            expect(during.body?.code ?? during.body?.message?.code).toBe(
                ERROR_CODES.SESSION_STORE_UNAVAILABLE,
            );
        } finally {
            if (handle) await handle.close();
            appClient.disconnect();
        }
    });
});

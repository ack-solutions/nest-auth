/**
 * Real-infrastructure test harness: a real Postgres and a real Redis, in
 * containers, plus the ability to boot TWO app instances against them.
 *
 * Why this exists: the library's Redis story cannot be proven on sqljs with an
 * in-process session store. Claims like "an authenticated request costs zero
 * database queries" or "a role change on instance A is visible to instance B on
 * the very next request" are only meaningful against real Redis, real Postgres
 * and two separate Nest applications sharing them.
 *
 * NO MOCKS. Containers are started per suite via the shared Testcontainers
 * helpers in `@ackplus/vitest-preset`.
 *
 * Docker is required. When it is not available the suite is SKIPPED with a
 * clear reason rather than failing — the default sqljs suites must keep working
 * for anyone without Docker.
 *
 * ```ts
 * const infra = describeWithRealInfra('redis guard', () => {
 *   it('costs no database query when warm', async () => {
 *     const a = await infra.bootInstance();
 *     // ...
 *   });
 * });
 * ```
 */

import { afterAll, beforeAll } from 'vitest';
import { bootTestApp, type BootTestAppOptions, type TestAppHandle } from './boot-test-app';
import type { IAuthModuleOptions } from '../../src';

/** Postgres + Redis connection details for a running pair of containers. */
export interface RealInfra {
    postgresUrl: string;
    redisUrl: string;
}

/**
 * Is Docker usable here? Probed SYNCHRONOUSLY at module load so suites can use
 * `describe.skipIf(!DOCKER_AVAILABLE)` and show up as *skipped* in the
 * reporter. A suite that returns early from every test reports as PASSED,
 * which is false confidence — the one thing a proving ground must not do.
 */
export const DOCKER_AVAILABLE: boolean = (() => {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { execSync } = require('node:child_process');
        execSync('docker info', { stdio: 'ignore', timeout: 15_000 });
        return true;
    } catch {
        return false;
    }
})();

/**
 * Start one Postgres and one Redis container for the lifetime of a suite.
 *
 * Returns a handle whose `available` flag tells the suite whether to run. The
 * containers are started in `beforeAll` and stopped in `afterAll`.
 */
export function setupRealInfra(opts: { startTimeoutMs?: number } = {}) {
    const startTimeoutMs = opts.startTimeoutMs ?? 180_000;

    let pg: any = null;
    let redis: any = null;
    let available = false;
    let reason = '';

    const booted: TestAppHandle[] = [];

    beforeAll(async () => {
        if (!DOCKER_AVAILABLE) {
            reason = 'Docker is not available';
            return;
        }
        try {
            const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
            const { RedisContainer } = await import('@testcontainers/redis');

            [pg, redis] = await Promise.all([
                new PostgreSqlContainer('postgres:16-alpine')
                    .withStartupTimeout(startTimeoutMs)
                    .start(),
                new RedisContainer('redis:7-alpine').withStartupTimeout(startTimeoutMs).start(),
            ]);
            available = true;
        } catch (e: any) {
            reason = `could not start containers: ${e?.message ?? e}`;
        }
    }, startTimeoutMs);

    afterAll(async () => {
        // Close apps first so their pools release before the containers go.
        for (const h of booted.splice(0)) {
            try {
                await h.close();
            } catch {
                /* a failed boot may leave a half-open app; keep tearing down */
            }
        }
        await Promise.allSettled([pg?.stop(), redis?.stop()]);
    }, startTimeoutMs);

    const handle = {
        get available() {
            return available;
        },
        get skipReason() {
            return reason;
        },
        info(): RealInfra {
            if (!available) throw new Error(`real infra unavailable: ${reason}`);
            return {
                postgresUrl: pg.getConnectionUri(),
                redisUrl: `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`,
            };
        },

        /**
         * Boot an app instance against the shared Postgres + Redis.
         *
         * The FIRST instance creates the schema; later instances must pass
         * `first: false` so they do not drop the schema out from under it.
         * Both share one Redis, which is the whole point — cross-instance
         * behaviour is only observable when the session store is shared.
         */
        async bootInstance(
            nestAuth: Partial<IAuthModuleOptions> = {},
            opts: { first?: boolean; bootOptions?: Partial<BootTestAppOptions> } = {},
        ): Promise<TestAppHandle> {
            const { postgresUrl, redisUrl } = this.info();
            const first = opts.first ?? booted.length === 0;

            const h = await bootTestApp({
                database: { driver: 'postgres', url: postgresUrl },
                // Only the first instance may drop/recreate; a second instance
                // dropping the schema would wipe the first instance's data.
                dropSchema: first,
                synchronize: first,
                ...(opts.bootOptions ?? {}),
                nestAuth: {
                    session: {
                        storageType: 'redis',
                        redis: { url: redisUrl },
                    },
                    ...nestAuth,
                } as IAuthModuleOptions,
            });
            booted.push(h);
            return h;
        },

        /** Close an instance early (e.g. to simulate one node going away). */
        async closeInstance(h: TestAppHandle): Promise<void> {
            const i = booted.indexOf(h);
            if (i >= 0) booted.splice(i, 1);
            await h.close();
        },
    };

    return handle;
}

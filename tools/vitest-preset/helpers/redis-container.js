/**
 * Redis Testcontainer helper for real Redis-session-store tests.
 *
 * NO MOCKS POLICY: boots a real Redis container.
 * Requires Docker.
 *
 * Usage:
 * ```ts
 * import { setupRedisContainer } from '@ackplus/vitest-preset/helpers/redis';
 *
 * describe('redis session store', () => {
 *   const redis = setupRedisContainer();
 *
 *   it('persists a session', async () => {
 *     const url = redis.connectionString();
 *     // ...
 *   });
 * });
 * ```
 */

import { RedisContainer } from '@testcontainers/redis';
import { beforeAll, afterAll } from 'vitest';

/**
 * @param {Object} [opts]
 * @param {string} [opts.image] - Redis image to use. Default 'redis:7-alpine'.
 * @param {boolean} [opts.installHooks] - Install vitest beforeAll/afterAll. Default true.
 * @param {number} [opts.startTimeoutMs] - Max wait for container ready. Default 60_000.
 */
export function setupRedisContainer(opts = {}) {
  const { image = 'redis:7-alpine', installHooks = true, startTimeoutMs = 60_000 } = opts;

  let started = null;

  async function start() {
    if (started) return started;
    started = await new RedisContainer(image)
      .withStartupTimeout(startTimeoutMs)
      .start();
    return started;
  }

  async function stop() {
    if (started) {
      await started.stop();
      started = null;
    }
  }

  async function flushAll() {
    if (!started) throw new Error('Redis container not started yet');
    const result = await started.exec(['redis-cli', 'FLUSHALL']);
    if (result.exitCode !== 0) {
      throw new Error(`flushAll failed: ${result.output}`);
    }
  }

  if (installHooks) {
    beforeAll(async () => {
      await start();
    }, startTimeoutMs);

    afterAll(async () => {
      await stop();
    });
  }

  return {
    start,
    stop,
    flushAll,

    info() {
      if (!started) throw new Error('Redis container not started yet');
      return {
        host: started.getHost(),
        port: started.getMappedPort(6379),
      };
    },

    connectionString() {
      const i = this.info();
      return `redis://${i.host}:${i.port}`;
    },

    container() {
      if (!started) throw new Error('Redis container not started yet');
      return started;
    },
  };
}

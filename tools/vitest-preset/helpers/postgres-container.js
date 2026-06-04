/**
 * Postgres Testcontainer helper for real integration tests.
 *
 * NO MOCKS POLICY: this boots a REAL Postgres container per test suite (or
 * shared across suites if the consumer wires it up that way). The helper just
 * sweetens the lifecycle — start, stop, truncate-between-tests, get connection.
 *
 * Requires Docker to be running. See test-catalog.md §No-mock policy.
 *
 * Usage:
 *
 * ```ts
 * import { setupPostgresContainer } from '@ackplus/vitest-preset/helpers/postgres';
 *
 * describe('my suite', () => {
 *   const pg = setupPostgresContainer(); // installs beforeAll/afterAll
 *
 *   beforeEach(async () => {
 *     await pg.truncateAll();             // clean slate per test
 *   });
 *
 *   it('does a thing', async () => {
 *     const url = pg.connectionString(); // e.g. for TypeORM DataSource
 *     // ...
 *   });
 * });
 * ```
 */

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { beforeAll, afterAll } from 'vitest';

/**
 * @typedef {Object} PostgresHandle
 * @property {() => string} connectionString  - Postgres URL (postgres://user:pass@host:port/db)
 * @property {() => { host: string; port: number; user: string; password: string; database: string }} info
 * @property {() => Promise<void>} truncateAll - Truncate all user tables (preserves schema)
 * @property {() => Promise<import('testcontainers').StartedTestContainer>} container - Raw started container
 * @property {(sql: string) => Promise<unknown>} exec - Run arbitrary SQL (uses `docker exec psql`)
 */

/**
 * @param {Object} [opts]
 * @param {string} [opts.image]         - Postgres image to use. Default 'postgres:16-alpine'.
 * @param {string} [opts.database]      - Database name. Default 'test'.
 * @param {string} [opts.user]          - User. Default 'test'.
 * @param {string} [opts.password]      - Password. Default 'test'.
 * @param {boolean} [opts.installHooks] - Install vitest beforeAll/afterAll automatically. Default true.
 * @param {number} [opts.startTimeoutMs] - Max wait for container ready. Default 60_000.
 * @returns {PostgresHandle}
 */
export function setupPostgresContainer(opts = {}) {
  const {
    image = 'postgres:16-alpine',
    database = 'test',
    user = 'test',
    password = 'test',
    installHooks = true,
    startTimeoutMs = 60_000,
  } = opts;

  /** @type {import('testcontainers').StartedTestContainer | null} */
  let started = null;
  let info = null;

  async function start() {
    if (started) return started;
    started = await new PostgreSqlContainer(image)
      .withDatabase(database)
      .withUsername(user)
      .withPassword(password)
      .withStartupTimeout(startTimeoutMs)
      .start();
    info = {
      host: started.getHost(),
      port: started.getMappedPort(5432),
      user: started.getUsername(),
      password: started.getPassword(),
      database: started.getDatabase(),
    };
    return started;
  }

  async function stop() {
    if (started) {
      await started.stop();
      started = null;
      info = null;
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
    /** Promise that resolves when container is ready (manual lifecycle path). */
    start,
    stop,

    info() {
      if (!info) throw new Error('Postgres container not started yet — call `await pg.start()` or use installHooks=true');
      return info;
    },

    connectionString() {
      const i = this.info();
      return `postgres://${i.user}:${i.password}@${i.host}:${i.port}/${i.database}`;
    },

    container() {
      if (!started) throw new Error('Postgres container not started yet');
      return started;
    },

    /**
     * Truncate every user table in the public schema.
     * Idempotent. Preserves schema (migrations) — only data is wiped.
     * Restarts identity sequences so id-1 starts fresh.
     */
    async truncateAll() {
      if (!started) throw new Error('Postgres container not started yet');
      // Single query gathers all user tables and truncates with CASCADE + RESTART IDENTITY.
      const truncateSql = `
        DO $$
        DECLARE
          stmt text;
        BEGIN
          SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
            INTO stmt
            FROM pg_tables
           WHERE schemaname = 'public';
          IF stmt IS NOT NULL THEN
            EXECUTE 'TRUNCATE TABLE ' || stmt || ' RESTART IDENTITY CASCADE';
          END IF;
        END;
        $$;
      `;
      const result = await started.exec(['psql', '-U', info.user, '-d', info.database, '-c', truncateSql]);
      if (result.exitCode !== 0) {
        throw new Error(`truncateAll failed: ${result.output}`);
      }
    },

    async exec(sql) {
      if (!started) throw new Error('Postgres container not started yet');
      const result = await started.exec(['psql', '-U', info.user, '-d', info.database, '-c', sql]);
      if (result.exitCode !== 0) {
        throw new Error(`exec failed: ${result.output}`);
      }
      return result.output;
    },
  };
}

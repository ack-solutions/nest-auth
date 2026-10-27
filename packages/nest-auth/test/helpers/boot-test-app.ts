/**
 * bootTestApp — boots a real NestJS test app with NestAuthModule (T-014).
 *
 * NO MOCKS POLICY: every dependency is a real implementation.
 *   - Real `@nestjs/testing` Test.createTestingModule + app.init()
 *   - Real TypeORM with `sqljs` in-memory driver (fast, no Docker) by default
 *   - Real EventEmitterModule
 *   - Real NestAuthModule with caller-provided config
 *   - Real ValidationPipe, real AuthExceptionFilter
 *
 * For Postgres-specific integration tests (e.g. session.tenantId column, partial
 * unique indexes), use `bootTestApp({ database: 'postgres', container: pg })`
 * with the Testcontainers helper.
 *
 * Returns an `INestApplication` ready for supertest.
 */

import 'reflect-metadata';
import deepmerge from 'deepmerge';
import { Test, TestingModule } from '@nestjs/testing';
import { Module, ValidationPipe, type INestApplication } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { NestAuthModule, type IAuthModuleOptions } from '../../src';

export interface BootTestAppOptions {
  /**
   * Database driver to use.
   *   - 'sqljs' (default): in-memory SQLite, no Docker, fastest.
   *   - 'sqlite': file-based SQLite (path required).
   *   - 'postgres': Postgres (host/port/user/pass/db required).
   */
  database?:
    | { driver: 'sqljs' }
    | { driver: 'sqlite'; path: string }
    | { driver: 'postgres'; url: string };

  /** Override the NestAuthModule config. Defaults to minimum-viable. */
  nestAuth?: Partial<IAuthModuleOptions>;

  /**
   * Extra TypeORM entities to load (for plugins / consumer-app tables).
   * The NestAuthModule's own entities are loaded automatically via
   * `autoLoadEntities: true`.
   */
  extraEntities?: any[];

  /** Extra controllers to mount (e.g. a guarded test controller for RBAC tests). */
  extraControllers?: any[];

  /** Extra providers to register. */
  extraProviders?: any[];

  /** Drop the schema after init (re-creates clean). Default: true. */
  dropSchema?: boolean;

  /**
   * Run TypeORM schema synchronization. Default: true.
   *
   * Set false for a SECOND app instance sharing one database: the first
   * instance already created the schema, and re-synchronizing from two
   * connections at once races.
   */
  synchronize?: boolean;

  /** Whether to log SQL. Default: false. */
  logQueries?: boolean;

  /**
   * Count the SQL this app issues. Pass a counter from {@link createQueryCounter}
   * to assert things like "a warm authenticated request costs zero queries".
   */
  queryCounter?: QueryCounter;
}

/**
 * Counts the SQL statements an app issues, so a test can assert the number of
 * database round trips a request costs. Only real queries are counted —
 * schema sync and TypeORM's own bookkeeping are filtered out by `reset()`
 * being called after boot and before the request under test.
 */
export interface QueryCounter {
  /** Statements seen since the last {@link QueryCounter.reset}. */
  readonly queries: string[];
  /** How many statements since the last reset. */
  readonly count: number;
  /** Forget everything seen so far. Call immediately before the act step. */
  reset(): void;
  /** The TypeORM logger to hand to the DataSource. */
  readonly logger: any;
}

/** Create a {@link QueryCounter} to pass as `bootTestApp({ queryCounter })`. */
export function createQueryCounter(): QueryCounter {
  const queries: string[] = [];
  const record = (query: string) => {
    // TypeORM issues its own metadata reads while connecting; they are not part
    // of a request's cost. Tests reset() right before the act step anyway, but
    // filtering the obvious noise keeps failure output readable.
    if (/^\s*(START TRANSACTION|COMMIT|ROLLBACK)/i.test(query)) return;
    queries.push(query);
  };

  const logger = {
    logQuery: (query: string) => record(query),
    logQueryError: (_e: any, query: string) => record(query),
    logQuerySlow: (_t: number, query: string) => record(query),
    logSchemaBuild: () => undefined,
    logMigration: () => undefined,
    log: () => undefined,
  };

  return {
    queries,
    get count() {
      return queries.length;
    },
    reset() {
      queries.length = 0;
    },
    logger,
  };
}

const DEFAULT_NEST_AUTH_CONFIG: IAuthModuleOptions = {
  appName: 'Test',
  session: {
    jwt: {
      secret: 'test-secret-do-not-use-in-prod',
      accessTokenExpiresIn: '15m',
      refreshTokenExpiresIn: '30d',
    },
  } as any,
  // Enable email + phone by default — most tests need at least one of these and
  // forgetting to enable them produces the cryptic PROVIDER_NOT_FOUND error.
  // Consumer can disable in a specific test by passing nestAuth: { emailAuth: { enabled: false } }.
  emailAuth: { enabled: true } as any,
  phoneAuth: { enabled: true } as any,
  adminConsole: {
    enabled: false, // Avoids the secretKey-required warning
  } as any,
};

function buildTypeOrmOptions(opts: BootTestAppOptions): TypeOrmModuleOptions {
  const db = opts.database ?? { driver: 'sqljs' };
  const common = {
    autoLoadEntities: true,
    synchronize: opts.synchronize ?? true,
    dropSchema: opts.dropSchema ?? true,
    ...(opts.queryCounter
      ? { logging: 'all' as const, logger: opts.queryCounter.logger }
      : { logging: opts.logQueries ?? false }),
  } as const;

  switch (db.driver) {
    case 'sqljs':
      return {
        type: 'sqljs',
        autoSave: false,
        location: ':memory:',
        ...common,
      } as any;
    case 'sqlite':
      return {
        type: 'better-sqlite3',
        database: db.path,
        ...common,
      } as any;
    case 'postgres': {
      const url = new URL(db.url);
      return {
        type: 'postgres',
        host: url.hostname,
        port: Number(url.port || 5432),
        username: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.replace(/^\//, ''),
        ...common,
      } as any;
    }
  }
}

/**
 * Boot a real NestJS app with NestAuthModule, ready for supertest assertions.
 *
 * @example
 * ```ts
 * import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
 *
 * describe('signup', () => {
 *   let handle: TestAppHandle;
 *
 *   beforeAll(async () => {
 *     handle = await bootTestApp({
 *       nestAuth: { appName: 'Signup Tests' },
 *     });
 *   });
 *
 *   afterAll(async () => {
 *     await handle.close();
 *   });
 *
 *   it('creates a user', async () => {
 *     const res = await request(handle.httpServer)
 *       .post('/auth/signup')
 *       .send({ email: 'a@b.test', password: 'StrongPass!1' });
 *     expect(res.status).toBe(201);
 *   });
 * });
 * ```
 */
export async function bootTestApp(opts: BootTestAppOptions = {}): Promise<TestAppHandle> {
  // Deep-merge so a test overriding a single field (e.g. session.accessTokenType
  // for cookie mode, or session.allowMultipleAccounts) keeps the rest of the
  // default session — including session.jwt.secret. A shallow spread would drop
  // the default secret and the module (which now requires one) would fail to boot.
  // `clone: false` matches the library's own AuthConfigService.setOptions merge
  // and preserves reference-type overrides (a live custom session store, hook
  // functions) that a deep clone would mangle.
  const explicitRedisClient = (opts.nestAuth?.session as any)?.redis?.client;
  const nestAuthConfig: IAuthModuleOptions = deepmerge(
    DEFAULT_NEST_AUTH_CONFIG,
    (opts.nestAuth ?? {}) as IAuthModuleOptions,
    { clone: false },
  );
  // See AuthConfigService.setOptions: deepmerge strips a class instance's
  // prototype, so a live ioredis client must be put back by reference.
  if (explicitRedisClient) {
    const session = nestAuthConfig.session as any;
    session.redis = { ...(session.redis ?? {}), client: explicitRedisClient };
  }

  @Module({
    imports: [
      EventEmitterModule.forRoot(),
      TypeOrmModule.forRoot(buildTypeOrmOptions(opts)),
      ...(opts.extraEntities && opts.extraEntities.length
        ? [TypeOrmModule.forFeature(opts.extraEntities)]
        : []),
      NestAuthModule.forRoot(nestAuthConfig),
    ],
    controllers: opts.extraControllers ?? [],
    providers: opts.extraProviders ?? [],
  })
  class TestRootModule {}

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [TestRootModule],
  }).compile();

  const app: INestApplication = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  return {
    app,
    moduleRef,
    httpServer: app.getHttpServer(),
    get: <T = any>(token: any): T => moduleRef.get<T>(token, { strict: false }),
    close: async () => {
      await app.close();
    },
  };
}

export interface TestAppHandle {
  app: INestApplication;
  moduleRef: TestingModule;
  /** Underlying HTTP server — pass to supertest's `request(handle.httpServer)`. */
  httpServer: any;
  /** Resolve a provider by token or class. */
  get<T = any>(token: any): T;
  /** Tear down the app. Call in `afterAll`. */
  close(): Promise<void>;
}

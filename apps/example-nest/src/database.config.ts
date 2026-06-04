/**
 * Database configuration for the example app.
 *
 * Defaults to PostgreSQL (configure with the `DB_*` env vars). For local testing
 * and CI we use a portable, in-memory SQLite database so the whole app boots with
 * zero external services — set `DB_DRIVER=sqlite` (the e2e test harness in
 * `test/setup-env.ts` does this automatically) or run with `NODE_ENV=test`.
 *
 * This keeps the reference app runnable anywhere: `DB_DRIVER=sqlite pnpm start`
 * gives you a throwaway database, while production points at real Postgres.
 */

import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { NestAuthEntities } from '@ackplus/nest-auth';
import { AppUser } from './user/user.entity';

export function buildDatabaseConfig(): TypeOrmModuleOptions {
    // nest-auth ships its own entities; we append the consumer's `AppUser` table
    // so the cross-system-sync demo (auth user <-> app user) works out of the box.
    const entities = [...NestAuthEntities, AppUser];

    const driver = (process.env.DB_DRIVER || '').toLowerCase();

    // Pure-JS in-memory SQLite (no native binding to compile) — the default for
    // tests/CI. Portable everywhere; this is what the package's own suite uses.
    if (driver === 'sqljs' || process.env.NODE_ENV === 'test') {
        return {
            type: 'sqljs',
            autoSave: false,
            location: ':memory:',
            entities,
            synchronize: true,
            dropSchema: true,
            logging: false,
        } as TypeOrmModuleOptions;
    }

    // File-backed / native SQLite for local dev that wants persistence.
    if (driver === 'sqlite') {
        return {
            type: 'better-sqlite3',
            database: process.env.DB_DATABASE || ':memory:',
            entities,
            synchronize: true,
            dropSchema: true,
            logging: false,
        } as TypeOrmModuleOptions;
    }

    return {
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USERNAME || 'ajaykhandla',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'nest-auth-example',
        entities,
        synchronize: true, // Auto-sync schema - disable in production
        logging: false,
    } as TypeOrmModuleOptions;
}

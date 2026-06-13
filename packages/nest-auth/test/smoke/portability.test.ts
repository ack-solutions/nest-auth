/**
 * Regression guards for cross-database / optional-peer portability.
 *
 * Covers two production-down bugs reported against 2.0.2:
 *   1. An entity column used `type: 'datetime'`, which Postgres rejects with
 *      DataTypeNotSupportedError — the app could not boot on Postgres.
 *   2. A social-auth provider statically imported its OPTIONAL peer
 *      (`apple-auth`), so the app crashed on boot ("Cannot find module
 *      'apple-auth'") unless every optional peer was installed.
 *
 * These guards run in the normal SQLite-backed suite — no Postgres or optional
 * peers required — so they always execute in CI. NO MOCKS.
 */

import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';
import { getMetadataArgsStorage } from 'typeorm';

// Eagerly import every entity so its @Column decorators register with TypeORM.
// import.meta.glob auto-discovers entities added later, so the guard keeps
// covering new entities without edits here.
const entityModules = import.meta.glob('../../src/lib/**/*.entity.ts', { eager: true });

// Column types that are NOT portable across the databases we support
// (Postgres + MySQL + SQLite): `datetime` is rejected by Postgres, `timestamp`
// by SQLite, and the rest are MySQL/MSSQL-specific. Date columns must rely on
// TypeORM inference — declare the property as `Date` with no explicit `type`,
// and TypeORM maps it to the correct per-driver type.
const NON_PORTABLE_COLUMN_TYPES = new Set([
  'datetime', 'datetime2', 'smalldatetime', 'timestamp', 'timestamptz',
  'timestamp without time zone', 'timestamp with time zone',
  'tinyint', 'mediumint', 'tinytext', 'mediumtext', 'longtext',
  'tinyblob', 'mediumblob', 'longblob', 'blob', 'double', 'year', 'set',
  'geometry', 'money', 'nvarchar', 'nchar', 'ntext',
]);

describe('entity column portability (Postgres / MySQL / SQLite)', () => {
  it('actually loaded the entity set', () => {
    expect(Object.keys(entityModules).length).toBeGreaterThan(0);
  });

  it('declares no dialect-specific @Column types (guards the revokedAt="datetime" bug)', () => {
    const offenders = getMetadataArgsStorage()
      .columns.map((col) => {
        const type = typeof col.options?.type === 'string' ? col.options.type.toLowerCase() : null;
        if (!type || !NON_PORTABLE_COLUMN_TYPES.has(type)) return null;
        const owner = typeof col.target === 'function' ? col.target.name : String(col.target);
        return `${owner}.${col.propertyName} → type: '${type}'`;
      })
      .filter((x): x is string => x !== null);

    expect(
      offenders,
      `Non-portable column type(s) found — use TypeORM inference instead:\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });
});

describe('optional social-auth peers are lazy-loaded (app boots without them installed)', () => {
  const read = (file: string) =>
    readFileSync(new URL(`../../src/lib/core/providers/${file}`, import.meta.url), 'utf8');

  // A *value* import emits a top-level `require(...)`; loading the provider then
  // forces the optional peer to be installed. `import type` is fully erased, and
  // a `require()` inside a method is lazy — both are fine.
  const valueImports = (src: string, mod: string) =>
    new RegExp(String.raw`^\s*import\s+(?!type\b)[^;]*from\s+['"]${mod}['"]`, 'm').test(src);

  it('apple-auth.provider does not statically value-import "apple-auth"', () => {
    expect(valueImports(read('apple-auth.provider.ts'), 'apple-auth')).toBe(false);
  });

  it('google-auth.provider does not statically value-import "google-auth-library"', () => {
    expect(valueImports(read('google-auth.provider.ts'), 'google-auth-library')).toBe(false);
  });

  it('facebook-auth.provider does not statically value-import "fb"', () => {
    expect(valueImports(read('facebook-auth.provider.ts'), 'fb')).toBe(false);
  });
});

/**
 * Jest `setupFiles` entry — runs ONCE per test file, BEFORE any application
 * module is imported. We force the portable in-memory SQLite database here so the
 * real AppModule boots with no external Postgres, and we pin the secrets the
 * config reads so tokens/cookies are deterministic across the suite.
 *
 * Because this runs before `src/app.module.ts` is evaluated, `buildDatabaseConfig()`
 * sees `DB_DRIVER=sqlite` and selects the better-sqlite3 driver.
 */

process.env.NODE_ENV = 'test';
process.env.DB_DRIVER = 'sqljs';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-test-jwt-secret-not-for-prod';
process.env.TRUSTED_DEVICE_SECRET = process.env.TRUSTED_DEVICE_SECRET || 'e2e-test-trusted-device-secret';
process.env.ADMIN_CONSOLE_SECRET_KEY =
    process.env.ADMIN_CONSOLE_SECRET_KEY || 'cArX1qCWcih8JVk8P19HT0vTrXnR8HcFPMpzminV/XE=';

// Keep the example's debug logging quiet during tests.
process.env.NEST_AUTH_DEBUG = 'false';

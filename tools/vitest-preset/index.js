// @ackplus/vitest-preset — base Vitest config preset
//
// Consume from a package's vitest.config.ts:
//   import { defineConfig } from 'vitest/config';
//   import preset from '@ackplus/vitest-preset';
//   export default defineConfig(preset({ /* package-specific overrides */ }));
//
// Phase 1 (T-011..T-021) populates the helpers/* directory with the real-test infrastructure
// (Testcontainers Postgres/Redis, OAuth stub server, email/SMS capture transports, etc.)
// Until then, this preset just provides sensible defaults.

/**
 * @param {import('vitest/config').UserConfig} [overrides]
 * @returns {import('vitest/config').UserConfig}
 */
export default function preset(overrides = {}) {
  return {
    test: {
      globals: false,
      testTimeout: 30_000,          // generous for integration tests with real DB
      hookTimeout: 60_000,          // Testcontainers startup
      pool: 'forks',                // process isolation per test file
      poolOptions: {
        forks: {
          singleFork: false,
        },
      },
      include: ['test/**/*.{spec,test}.ts', 'src/**/*.{spec,test}.ts'],
      exclude: ['node_modules', 'dist', '.turbo'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov', 'html'],
        exclude: [
          '**/node_modules/**',
          '**/dist/**',
          '**/test/**',
          '**/*.config.*',
          '**/*.d.ts',
        ],
      },
      ...overrides.test,
    },
    ...overrides,
  };
}

/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

// Backend tests need `emitDecoratorMetadata: true` for TypeORM and NestJS DI.
// vitest's default esbuild transform doesn't emit metadata; swc does.
export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
        target: 'es2022',
      },
      module: { type: 'es6' },
    }),
  ],
  test: {
    globals: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: false },
    },
    include: ['test/**/*.{spec,test}.ts', 'src/**/*.{spec,test}.ts'],
    exclude: ['node_modules', 'dist', '.turbo'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/test/**', '**/*.config.*', '**/*.d.ts'],
    },
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.{test,spec}.ts'],
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});

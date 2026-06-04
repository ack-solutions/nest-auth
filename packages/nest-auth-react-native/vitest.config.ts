import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Boot the real backend once, in the main process (not a worker), and
        // hand its URL to the tests via `inject('baseUrl')`.
        globalSetup: ['./test/global-setup.ts'],
        hookTimeout: 60_000,
        testTimeout: 30_000,
    },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
    plugins: [
        react({
            // Disable ESLint plugin during build
            jsxRuntime: 'automatic',
        }),
        // Inline JS and CSS into the generated index.html
        viteSingleFile(),
    ],
    optimizeDeps: {
        include: ['react', 'react-dom', 'react/jsx-runtime'],
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
        },
        // Ensure a single copy of React so hooks resolve correctly (avoids "Invalid hook call" / useState is null)
        dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
    },
    build: {
        // Writes into the backend package's dist so AdminConsoleController serves it.
        // T-109 (Phase 5) will move output to nest-auth-admin/dist and the backend will read via workspace symlink.
        outDir: '../nest-auth/dist/lib/admin-console/static',
        emptyOutDir: false,
        // Continue build even with TypeScript errors
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
            },
            // singlefile handles inlining; filenames no longer matter
        },
    },
    base: './',
    // Disable linting in dev mode
    esbuild: {
        // Ignore linting errors
        logOverride: { 'this-is-undefined-in-esm': 'silent' },
    },
});

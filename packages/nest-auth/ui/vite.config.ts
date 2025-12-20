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
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
        },
    },
    build: {
        outDir: '../src/lib/admin-console/static',
        emptyOutDir: true,
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

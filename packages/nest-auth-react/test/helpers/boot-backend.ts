/**
 * Spawns a REAL nest-auth backend (the built `example-nest` app) as its own
 * process with an in-memory sqljs database, and waits until it answers HTTP.
 * Gives the client SDK a genuine remote server to talk to over the wire. No mocks.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
// packages/nest-auth-client/test/helpers -> repo root
const REPO_ROOT = resolve(here, '../../../..');
const SERVER_ENTRY = resolve(REPO_ROOT, 'apps/example-nest/dist/main.js');

export interface BackendHandle {
    /** Includes the `/api` global prefix — point the AuthClient baseUrl here. */
    baseUrl: string;
    close(): Promise<void>;
}

function getFreePort(): Promise<number> {
    return new Promise((res, rej) => {
        const srv = createServer();
        srv.unref();
        srv.on('error', rej);
        srv.listen(0, '127.0.0.1', () => {
            const port = (srv.address() as { port: number }).port;
            srv.close(() => res(port));
        });
    });
}

async function waitForReady(baseUrl: string, getLog: () => string, timeoutMs = 40_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const r = await fetch(`${baseUrl}/auth/client-config`);
            if (r.status < 500) return;
        } catch {
            /* not listening yet */
        }
        await new Promise((r) => setTimeout(r, 300));
    }
    throw new Error(`example-nest backend did not become ready in ${timeoutMs}ms.\n--- server log ---\n${getLog()}`);
}

export async function bootBackend(extraEnv: Record<string, string> = {}): Promise<BackendHandle> {
    const port = await getFreePort();
    let log = '';

    const child: ChildProcess = spawn(process.execPath, [SERVER_ENTRY], {
        cwd: REPO_ROOT,
        env: {
            ...process.env,
            PORT: String(port),
            DB_DRIVER: 'sqljs',
            NODE_ENV: 'test',
            JWT_SECRET: 'client-sdk-test-jwt-secret',
            TRUSTED_DEVICE_SECRET: 'client-sdk-test-trusted-device-secret',
            ADMIN_CONSOLE_SECRET_KEY: 'client-sdk-test-admin-console-secret-0001',
            TENANT_MODE: 'disabled',
            ...extraEnv,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout?.on('data', (d) => { log += d.toString(); });
    child.stderr?.on('data', (d) => { log += d.toString(); });

    const baseUrl = `http://127.0.0.1:${port}/api`;

    try {
        await waitForReady(baseUrl, () => log);
    } catch (err) {
        child.kill('SIGKILL');
        throw err;
    }

    return {
        baseUrl,
        close: async () => {
            child.kill('SIGTERM');
            await new Promise((r) => setTimeout(r, 200));
            if (!child.killed) child.kill('SIGKILL');
        },
    };
}

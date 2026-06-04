import { bootBackend, type BackendHandle } from './helpers/boot-backend';

let backend: BackendHandle | undefined;

export async function setup({ provide }: { provide: (k: string, v: unknown) => void }) {
    backend = await bootBackend();
    provide('baseUrl', backend.baseUrl);
}

export async function teardown() {
    if (backend) await backend.close();
}

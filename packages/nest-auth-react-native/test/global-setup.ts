import { generateKeyPairSync } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { bootBackend, type BackendHandle } from './helpers/boot-backend';

let backend: BackendHandle | undefined;
let jwksServer: Server | undefined;

// Apple native-signin test fixtures — a real RSA keypair served as a JWKS so the
// backend can verify locally-signed identityTokens (no mocks).
export const APPLE_KID = 'rn-test-apple-key-1';
export const APPLE_SERVICE_ID = 'com.test.rn.service';
export const APPLE_BUNDLE_ID = 'com.test.rn.app';

export async function setup({ provide }: { provide: (k: string, v: unknown) => void }) {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const applePrivateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    const jwk: any = publicKey.export({ format: 'jwk' });
    jwk.kid = APPLE_KID;
    jwk.alg = 'RS256';
    jwk.use = 'sig';

    const jwksUrl = await new Promise<string>((resolve) => {
        jwksServer = createServer((_req, res) => {
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ keys: [jwk] }));
        }).listen(0, '127.0.0.1', () => {
            const addr = jwksServer!.address() as { port: number };
            resolve(`http://127.0.0.1:${addr.port}`);
        });
    });

    backend = await bootBackend({
        APPLE_CLIENT_ID: APPLE_SERVICE_ID,
        APPLE_AUDIENCES: `${APPLE_SERVICE_ID},${APPLE_BUNDLE_ID}`,
        APPLE_JWKS_URL: jwksUrl,
    });

    provide('baseUrl', backend.baseUrl);
    provide('applePrivateKeyPem', applePrivateKeyPem);
    provide('appleKid', APPLE_KID);
    provide('appleAudience', APPLE_BUNDLE_ID);
}

export async function teardown() {
    if (backend) await backend.close();
    if (jwksServer) await new Promise<void>((r) => jwksServer!.close(() => r()));
}

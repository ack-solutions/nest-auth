/**
 * Real (no-mock) tests for native Apple "Sign in with Apple" — the browser-free
 * mobile flow where the app sends an Apple identityToken.
 *
 * We generate a real RSA keypair, serve it as a JWKS over a real local HTTP
 * server (pointed to via `apple.jwksUrl`), and sign genuine RS256 tokens that
 * look like Apple's. The provider verifies them with real crypto — no mocks.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { generateKeyPairSync } from 'crypto';
import { createServer, type Server } from 'http';
import * as jwt from 'jsonwebtoken';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

const KID = 'test-apple-key-1';
const ISSUER = 'https://appleid.apple.com';
const SERVICE_ID = 'com.test.service'; // web "Service ID"
const BUNDLE_ID = 'com.test.app'; // native iOS bundle id

let privatePem: string;
let jwksServer: Server;
let jwksUrl: string;

function signAppleToken(opts: {
    aud?: string;
    sub?: string;
    email?: string;
    nonce?: string;
    expiresIn?: string | number;
} = {}): string {
    return jwt.sign(
        {
            email: opts.email ?? 'apple-user@test.local',
            email_verified: true,
            ...(opts.nonce ? { nonce: opts.nonce } : {}),
        },
        privatePem,
        {
            algorithm: 'RS256',
            issuer: ISSUER,
            audience: opts.aud ?? BUNDLE_ID,
            subject: opts.sub ?? 'apple-sub-123',
            keyid: KID,
            expiresIn: opts.expiresIn ?? '1h',
        },
    );
}

describe('Apple native identityToken login', () => {
    let handle: TestAppHandle;

    beforeAll(async () => {
        const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
        privatePem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();

        const jwk: any = publicKey.export({ format: 'jwk' });
        jwk.kid = KID;
        jwk.alg = 'RS256';
        jwk.use = 'sig';

        await new Promise<void>((resolve) => {
            jwksServer = createServer((_req, res) => {
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify({ keys: [jwk] }));
            }).listen(0, '127.0.0.1', () => resolve());
        });
        const addr = jwksServer.address() as { port: number };
        jwksUrl = `http://127.0.0.1:${addr.port}`;

        handle = await bootTestApp({
            nestAuth: {
                apple: {
                    clientId: SERVICE_ID,
                    audiences: [SERVICE_ID, BUNDLE_ID],
                    jwksUrl,
                } as any,
            },
        });
    }, 60_000);

    afterAll(async () => {
        if (handle) await handle.close();
        if (jwksServer) await new Promise<void>((r) => jwksServer.close(() => r()));
    });

    function appleLogin(token: string, extra: Record<string, any> = {}) {
        return request(handle.httpServer)
            .post('/auth/login')
            .send({
                providerName: 'apple',
                credentials: { token, ...extra },
                createUserIfNotExists: true,
            });
    }

    it('verifies a native identityToken (Bundle ID audience) and signs in', async () => {
        const token = signAppleToken({
            aud: BUNDLE_ID,
            sub: 'apple-sub-native',
            email: 'native-apple@test.local',
            nonce: 'nonce-1',
        });
        const res = await appleLogin(token, { nonce: 'nonce-1', name: 'Ada Lovelace' });
        expect(res.status).toBeLessThan(300);
        expect(res.body.accessToken).toBeTruthy();
    });

    it('also accepts the web Service ID audience', async () => {
        const token = signAppleToken({ aud: SERVICE_ID, sub: 'apple-sub-web', email: 'web-apple@test.local' });
        const res = await appleLogin(token);
        expect(res.status).toBeLessThan(300);
    });

    it('rejects an unknown audience', async () => {
        const token = signAppleToken({ aud: 'com.evil.app', sub: 'apple-sub-evil' });
        const res = await appleLogin(token);
        expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('rejects a nonce mismatch', async () => {
        const token = signAppleToken({ sub: 'apple-sub-nonce', nonce: 'real-nonce' });
        const res = await appleLogin(token, { nonce: 'wrong-nonce' });
        expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('rejects an expired token', async () => {
        const token = signAppleToken({ sub: 'apple-sub-exp', expiresIn: -3600 });
        const res = await appleLogin(token);
        expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('rejects a tampered token', async () => {
        const token = signAppleToken({ sub: 'apple-sub-tamper' });
        const tampered = token.slice(0, -4) + (token.endsWith('aaaa') ? 'bbbb' : 'aaaa');
        const res = await appleLogin(tampered);
        expect(res.status).toBeGreaterThanOrEqual(400);
    });
});

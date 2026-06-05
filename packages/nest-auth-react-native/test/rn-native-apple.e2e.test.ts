/**
 * Real (no-mock) E2E for the native Apple wrapper: `signInWithApple` drives a
 * fake native module (standing in for `expo-apple-authentication`) that returns
 * a locally-signed identityToken, and the REAL backend verifies it against the
 * REAL JWKS served from global-setup. The only injected boundary is the native
 * device call; the token, verification, HTTP, DB, and session are all real.
 */
import { describe, it, expect, inject } from 'vitest';
import * as jwt from 'jsonwebtoken';
import {
    createNestAuthClient,
    AsyncStorageAdapter,
    signInWithApple,
    type AsyncStorageLike,
} from '../src';

const ISSUER = 'https://appleid.apple.com';

function memStore(): AsyncStorageLike {
    const m = new Map<string, string>();
    return {
        getItem: async (k) => m.get(k) ?? null,
        setItem: async (k, v) => {
            m.set(k, v);
        },
        removeItem: async (k) => {
            m.delete(k);
        },
    };
}

describe('RN native Apple sign-in (signInWithApple → real backend)', () => {
    const baseUrl = inject('baseUrl') as string;
    const privateKeyPem = inject('applePrivateKeyPem') as string;
    const kid = inject('appleKid') as string;
    const audience = inject('appleAudience') as string;

    function signToken(opts: { sub: string; email: string; nonce?: string }): string {
        return jwt.sign(
            {
                email: opts.email,
                email_verified: true,
                ...(opts.nonce ? { nonce: opts.nonce } : {}),
            },
            privateKeyPem,
            {
                algorithm: 'RS256',
                issuer: ISSUER,
                audience,
                subject: opts.sub,
                keyid: kid,
                expiresIn: '1h',
            },
        );
    }

    function makeClient() {
        return createNestAuthClient({ baseUrl, storage: new AsyncStorageAdapter(memStore()) });
    }

    it('exchanges a native Apple identityToken for a session', async () => {
        const nonce = 'rn-nonce-1';
        const idToken = signToken({ sub: 'rn-apple-sub-1', email: 'rn-apple@test.local', nonce });
        const client = makeClient();

        // Stands in for the native module (expo-apple-authentication).
        const fakeAppleAuth = {
            AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
            signInAsync: async () => ({
                identityToken: idToken,
                fullName: { givenName: 'Ada', familyName: 'Lovelace' },
            }),
        };

        const res = await signInWithApple(client, fakeAppleAuth, { nonce });

        expect(res.accessToken).toBeTruthy();
        expect(client.getIsAuthenticated()).toBe(true);

        const user = await client.getSessionUserData();
        expect(user.email).toBe('rn-apple@test.local');
    });

    it('rejects when the nonce does not match the token', async () => {
        const idToken = signToken({ sub: 'rn-apple-sub-2', email: 'rn-apple2@test.local', nonce: 'real' });
        const client = makeClient();
        const fakeAppleAuth = { signInAsync: async () => ({ identityToken: idToken }) };

        await expect(signInWithApple(client, fakeAppleAuth, { nonce: 'wrong' })).rejects.toBeTruthy();
        expect(client.getIsAuthenticated()).toBe(false);
    });
});

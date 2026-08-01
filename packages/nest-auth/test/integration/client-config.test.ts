/**
 * Real integration tests for GET /auth/client-config — public capability flags
 * for login/signup UIs (passwordless, OAuth client ids, platform access, etc.).
 * Asserts secrets never leak. NO MOCKS.
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { bootTestApp } from '../helpers/boot-test-app';

describe('GET /auth/client-config', () => {
  it('returns defaults for disabled optional auth methods', async () => {
    const handle = await bootTestApp();
    const res = await request(handle.httpServer).get('/auth/client-config');
    expect(res.status).toBe(200);
    expect(res.body.emailAuth).toEqual({ enabled: true });
    expect(res.body.phoneAuth).toEqual({ enabled: true });
    expect(res.body.passwordless).toEqual({ enabled: false, allowSignUp: false });
    expect(res.body.google).toEqual({ enabled: false });
    expect(res.body.facebook).toEqual({ enabled: false });
    expect(res.body.apple).toEqual({ enabled: false });
    expect(res.body.github).toEqual({ enabled: false });
    expect(res.body.customProviders).toEqual([]);
    expect(res.body.platformAccess).toEqual({ enabled: false });
    expect(res.body.accessTokenType).toBe('header');
    await handle.close();
  });

  it('surfaces passwordless, OAuth public ids, and platformAccess when configured', async () => {
    const handle = await bootTestApp({
      nestAuth: {
        passwordless: { enabled: true, allowSignUp: true } as any,
        platformAccess: { enabled: true, validate: () => true } as any,
        google: {
          clientId: 'google-public-client-id',
          clientSecret: 'google-SECRET-must-not-leak',
          redirectUri: 'http://localhost/callback',
        } as any,
        facebook: {
          appId: 'fb-public-app-id',
          appSecret: 'fb-SECRET-must-not-leak',
          redirectUri: 'http://localhost/callback',
        } as any,
        github: {
          clientId: 'gh-public-client-id',
          clientSecret: 'gh-SECRET-must-not-leak',
          redirectUri: 'http://localhost/callback',
        } as any,
        apple: {
          clientId: 'apple-public-client-id',
          teamId: 'TEAM',
          keyId: 'KEY',
          privateKey: '-----BEGIN PRIVATE KEY-----\napple-SECRET\n-----END PRIVATE KEY-----',
          redirectUri: 'http://localhost/callback',
        } as any,
        session: {
          accessTokenType: 'cookie',
          jwt: {
            secret: 'test-secret-do-not-use-in-prod',
            accessTokenExpiresIn: '15m',
            refreshTokenExpiresIn: '30d',
          },
        } as any,
      },
    });

    const res = await request(handle.httpServer).get('/auth/client-config');
    expect(res.status).toBe(200);
    expect(res.body.passwordless).toEqual({ enabled: true, allowSignUp: true });
    expect(res.body.platformAccess).toEqual({ enabled: true });
    expect(res.body.accessTokenType).toBe('cookie');
    expect(res.body.google).toEqual({ enabled: true, clientId: 'google-public-client-id' });
    expect(res.body.facebook).toEqual({ enabled: true, appId: 'fb-public-app-id' });
    expect(res.body.github).toEqual({ enabled: true, clientId: 'gh-public-client-id' });
    expect(res.body.apple).toEqual({ enabled: true, clientId: 'apple-public-client-id' });

    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('SECRET');
    expect(serialized).not.toContain('PRIVATE KEY');
    expect(serialized).not.toContain('appSecret');
    expect(serialized).not.toContain('clientSecret');
    expect(serialized).not.toContain('privateKey');

    await handle.close();
  });
});

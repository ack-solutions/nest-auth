/**
 * passwordlessLogin — completes a passwordless sign-in by exchanging the OTP for
 * a session via POST /auth/login (providerName: 'passwordless').
 *
 * NO MOCKS of the client: a real AuthClient + real MemoryStorage. A tiny real
 * HttpAdapter captures the outgoing request and returns a real (valid-JWT) auth
 * response, so we assert the exact login call the wrapper builds.
 */
import { describe, it, expect } from 'vitest';
import { AuthClient, MemoryStorage } from '../../src';
import type { HttpAdapter, HttpRequestOptions } from '../../src';
import { makeValidJwt } from '../fixtures/jwt.fixtures';

function capturingClient() {
  const calls: HttpRequestOptions[] = [];
  const adapter: HttpAdapter = {
    async request(opts) {
      calls.push(opts);
      return {
        status: 200,
        ok: true,
        headers: {},
        data: { accessToken: makeValidJwt({ sub: 'u-pwl' }), refreshToken: 'r-1' },
      } as any;
    },
  };
  const client = new AuthClient({
    baseUrl: 'http://test.local',
    accessTokenType: 'header',
    storage: new MemoryStorage(),
    httpAdapter: adapter,
    autoRefresh: false,
  });
  const loginCall = () => calls.find((c) => c.url.endsWith('/auth/login'));
  return { client, loginCall };
}

describe('AuthClient.passwordlessLogin', () => {
  it('POSTs to /auth/login with providerName=passwordless and a channels array, and authenticates', async () => {
    const { client, loginCall } = capturingClient();
    await client.ready();

    const res = await client.passwordlessLogin({ identifier: 'a@b.com', code: '123456', channel: 'email', tenantId: 't1' });

    const call = loginCall();
    expect(call).toBeTruthy();
    expect(call!.method).toBe('POST');
    expect(call!.body).toMatchObject({
      providerName: 'passwordless',
      credentials: { identifier: 'a@b.com', code: '123456', channels: ['email'] },
      tenantId: 't1',
    });
    expect((res as any).accessToken ?? (res as any).tokens?.accessToken).toBeTruthy();
    expect(client.getIsAuthenticated()).toBe(true);
  });

  it('defaults channel to both email and sms when omitted', async () => {
    const { client, loginCall } = capturingClient();
    await client.ready();
    await client.passwordlessLogin({ identifier: '+15551230000', code: '999' });
    expect(loginCall()!.body.credentials.channels).toEqual(['email', 'sms']);
  });

  it('accepts an explicit channels array', async () => {
    const { client, loginCall } = capturingClient();
    await client.ready();
    await client.passwordlessLogin({ identifier: 'a@b.com', code: '1', channel: ['sms'] });
    expect(loginCall()!.body.credentials.channels).toEqual(['sms']);
  });
});

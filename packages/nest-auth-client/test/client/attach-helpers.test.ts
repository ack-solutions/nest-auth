/**
 * Real tests for attachToAxios / attachToFetch (T-167c).
 *
 * NO MOCKS. Uses:
 *   - Real `AuthClient` + real `MemoryStorage` + real `TokenManager`
 *   - Real `FakeAxios` (a real implementation of `AxiosLikeInstance`, not a jest mock)
 *   - Real `fetch` substituted with a tiny dispatcher function (also a real impl)
 *
 * Covers: TC-token-1, TC-token-2, TC-token-3, TC-token-4, TC-token-5 from
 * .tasks/client-sdk-token-handling.md
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuthClient } from '../../src/client/auth-client';
import { MemoryStorage } from '../../src/storage/memory.storage';
import { FakeAxios, makeAxiosError } from '../fixtures/fake-axios';
import { makeValidJwt } from '../fixtures/jwt.fixtures';

function newClient(opts?: any): AuthClient {
  return new AuthClient({
    baseUrl: 'http://test.local',
    accessTokenType: 'header',
    storage: new MemoryStorage(),
    autoRefresh: false,
    ...opts,
  });
}

describe('attachToAxios — T-167c', () => {
  let client: AuthClient;
  let token: string;

  beforeEach(async () => {
    client = newClient();
    await client.ready();
    token = makeValidJwt({ sub: 'u-1' });
    await (client as any).tokenManager.setTokens({ accessToken: token, refreshToken: 'r-1' });
  });

  it('TC-token-1: request interceptor adds Authorization header', async () => {
    const seenHeaders: any[] = [];
    const axios = new FakeAxios(async (config) => {
      seenHeaders.push(config.headers);
      return { status: 200, config, data: { ok: true } };
    });

    client.attachToAxios(axios);

    await axios.request({ url: '/api/me' });

    expect(seenHeaders[0].Authorization).toBe(`Bearer ${token}`);
    expect(seenHeaders[0]['x-access-token-type']).toBe('header');
  });

  it('TC-token-4: unsubscribe function ejects both interceptors', async () => {
    const seenHeaders: any[] = [];
    const axios = new FakeAxios(async (config) => {
      seenHeaders.push(config.headers);
      return { status: 200, config };
    });

    const unsub = client.attachToAxios(axios);

    await axios.request({ url: '/before' });
    expect(seenHeaders[0]?.Authorization).toBeDefined();

    unsub();

    await axios.request({ url: '/after' });
    // After unsubscribe, no headers added
    expect(seenHeaders[1]?.Authorization).toBeUndefined();
  });

  it('skipPaths: string match — auth headers skipped', async () => {
    const seenHeaders: any[] = [];
    const axios = new FakeAxios(async (config) => {
      seenHeaders.push({ url: config.url, hasAuth: !!config.headers?.Authorization });
      return { status: 200, config };
    });

    client.attachToAxios(axios, { skipPaths: ['/public/data'] });

    await axios.request({ url: '/api/me' });
    await axios.request({ url: '/public/data' });

    expect(seenHeaders[0]).toEqual({ url: '/api/me', hasAuth: true });
    expect(seenHeaders[1]).toEqual({ url: '/public/data', hasAuth: false });
  });

  it('skipPaths: regex match works', async () => {
    const calls: any[] = [];
    const axios = new FakeAxios(async (config) => {
      calls.push({ url: config.url, hasAuth: !!config.headers?.Authorization });
      return { status: 200, config };
    });

    client.attachToAxios(axios, { skipPaths: [/^\/public\//] });

    await axios.request({ url: '/public/x' });
    await axios.request({ url: '/api/y' });

    expect(calls[0].hasAuth).toBe(false);
    expect(calls[1].hasAuth).toBe(true);
  });

  it('skipPaths: function predicate works', async () => {
    const calls: any[] = [];
    const axios = new FakeAxios(async (config) => {
      calls.push({ url: config.url, hasAuth: !!config.headers?.Authorization });
      return { status: 200, config };
    });

    client.attachToAxios(axios, {
      skipPaths: [(url) => url.includes('legacy')],
    });

    await axios.request({ url: '/api/legacy/x' });
    await axios.request({ url: '/api/modern/y' });

    expect(calls[0].hasAuth).toBe(false);
    expect(calls[1].hasAuth).toBe(true);
  });

  it('opts.retryOn401=false → does NOT retry, throws original error', async () => {
    const axios = new FakeAxios(async (config) => {
      throw makeAxiosError(401, config);
    });

    client.attachToAxios(axios, { retryOn401: false });

    await expect(axios.request({ url: '/api/forbidden' })).rejects.toThrow('HTTP 401');
    expect(axios.dispatchCount).toBe(1); // no retry
  });

  it('cookie mode: sets withCredentials=true on the request config', async () => {
    const cookieClient = newClient({ accessTokenType: 'cookie' });
    await cookieClient.ready();

    let seenConfig: any;
    const axios = new FakeAxios(async (config) => {
      seenConfig = config;
      return { status: 200, config };
    });

    cookieClient.attachToAxios(axios);
    await axios.request({ url: '/api/me' });

    expect(seenConfig.withCredentials).toBe(true);
    expect(seenConfig.headers.Authorization).toBeUndefined();
    expect(seenConfig.headers['x-access-token-type']).toBe('cookie');
  });

  it('preserves user-supplied headers — auth headers are merged, not replaced', async () => {
    let seen: any;
    const axios = new FakeAxios(async (config) => {
      seen = config.headers;
      return { status: 200, config };
    });

    client.attachToAxios(axios);
    await axios.request({
      url: '/api/me',
      headers: { 'X-Trace-Id': 'abc-123', 'Authorization': 'should-be-overridden' },
    });

    expect(seen['X-Trace-Id']).toBe('abc-123');                  // preserved
    expect(seen['Authorization']).toBe(`Bearer ${token}`);       // overridden by our interceptor
  });
});

describe('attachToFetch — T-167c', () => {
  let client: AuthClient;
  let token: string;

  beforeEach(async () => {
    client = newClient();
    await client.ready();
    token = makeValidJwt({ sub: 'u-fetch' });
    await (client as any).tokenManager.setTokens({ accessToken: token, refreshToken: 'r-1' });
  });

  /**
   * Build a real fetch function backed by a dispatcher. Not a mock — this is
   * a real implementation that returns a real Response.
   */
  function dispatchableFetch(dispatcher: (url: string, init: RequestInit) => Response | Promise<Response>) {
    return async (input: any, init?: any): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString();
      return dispatcher(url, init ?? {});
    };
  }

  it('wraps fetch with Authorization header on every call', async () => {
    const seen: any[] = [];
    const myFetch = client.attachToFetch(
      dispatchableFetch((url, init) => {
        seen.push({ url, headers: init.headers });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }) as typeof globalThis.fetch,
    );

    await myFetch('/api/me');
    await myFetch('/api/data');

    expect((seen[0].headers as any).Authorization).toBe(`Bearer ${token}`);
    expect((seen[1].headers as any).Authorization).toBe(`Bearer ${token}`);
  });

  it('cookie mode: sets credentials: "include"', async () => {
    const cookieClient = newClient({ accessTokenType: 'cookie' });
    await cookieClient.ready();

    let seenInit: any;
    const myFetch = cookieClient.attachToFetch(
      dispatchableFetch((_, init) => {
        seenInit = init;
        return new Response('{}', { status: 200 });
      }) as typeof globalThis.fetch,
    );

    await myFetch('/api/me');

    expect(seenInit.credentials).toBe('include');
    expect((seenInit.headers as any).Authorization).toBeUndefined();
  });

  it('skipPaths skips both auth headers AND 401 retry', async () => {
    let calls = 0;
    const myFetch = client.attachToFetch(
      dispatchableFetch((url) => {
        calls++;
        return new Response(JSON.stringify({ url }), { status: url.includes('/skip') ? 401 : 200 });
      }) as typeof globalThis.fetch,
      { skipPaths: ['/skip-me'] },
    );

    const res = await myFetch('/api/skip-me');
    expect(res.status).toBe(401);
    expect(calls).toBe(1); // not retried
  });

  it('preserves user-supplied headers', async () => {
    let seen: any;
    const myFetch = client.attachToFetch(
      dispatchableFetch((_, init) => {
        seen = init.headers;
        return new Response('{}', { status: 200 });
      }) as typeof globalThis.fetch,
    );

    await myFetch('/api/me', { headers: { 'X-Trace-Id': 'fetch-trace' } });
    expect((seen as any)['X-Trace-Id']).toBe('fetch-trace');
    expect((seen as any).Authorization).toBe(`Bearer ${token}`);
  });
});

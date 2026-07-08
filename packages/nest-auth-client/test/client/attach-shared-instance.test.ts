/**
 * Regression: sharing ONE axios for both AuthClient (httpAdapter:
 * createAxiosAdapter(api)) AND attachToAxios(client, api) must not deadlock on an
 * expired session.
 *
 * Before the fix: boot verifySession 401 -> the app interceptor starts refresh();
 * the refresh-token request goes through the SAME interceptor -> a nested refresh()
 * parks on RefreshQueue while the outer refresh awaits its own HTTP call -> deadlock
 * (verifySession never settles, UI never redirects, tokens never cleared).
 *
 * After the fix: createAxiosAdapter tags AuthClient's own requests and attachToAxios
 * skips them (+ default-skips the auth endpoints), so AuthClient's own 401->refresh
 * runs once and settles.
 *
 * NO MOCKS of the client: real AuthClient + real MemoryStorage + real createAxiosAdapter
 * + a real FakeAxios that runs interceptors.
 */
import { describe, it, expect } from 'vitest';
import { AuthClient, MemoryStorage, createAxiosAdapter } from '../../src';
import { FakeAxios, makeAxiosError } from '../fixtures/fake-axios';
import { makeValidJwt } from '../fixtures/jwt.fixtures';

const BASE = 'http://test.local';
const ends = (u: string, s: string) => typeof u === 'string' && u.endsWith(s);

function withTimeout<T>(p: Promise<T>, ms = 1500): Promise<T | 'TIMEOUT'> {
  return Promise.race([p, new Promise<'TIMEOUT'>((r) => setTimeout(() => r('TIMEOUT'), ms))]);
}

function setup(dispatch: (cfg: any) => any) {
  const axios = new FakeAxios(dispatch);
  const client = new AuthClient({
    baseUrl: BASE,
    accessTokenType: 'header',
    storage: new MemoryStorage(),
    httpAdapter: createAxiosAdapter(axios),
    autoRefresh: true,
  });
  client.attachToAxios(axios);
  return { client, axios };
}

describe('shared axios (createAxiosAdapter + attachToAxios)', () => {
  it('expired session RESOLVES (no deadlock) and clears tokens', async () => {
    const { client } = setup((cfg) => {
      const u = cfg.url as string;
      if (ends(u, '/auth/verify-session') || ends(u, '/auth/refresh-token')) throw makeAxiosError(401, cfg);
      // refresh() logs out on failure; anything else is a benign 200
      return { status: 200, data: {}, headers: {} };
    });
    await client.ready();
    await (client as any).tokenManager.setTokens({ accessToken: makeValidJwt({ sub: 'u1' }), refreshToken: 'r-1' });

    const result = await withTimeout(client.verifySession(), 1500);
    expect(result).not.toBe('TIMEOUT'); // a deadlock would time out here
    expect((result as any).valid).toBe(false);
    expect(client.getIsAuthenticated()).toBe(false); // refresh-failure logout cleared state
  });

  it('app requests through the shared instance still get the Authorization header', async () => {
    let appHeaders: any;
    const { client, axios } = setup((cfg) => {
      if (ends(cfg.url, '/api/data')) {
        appHeaders = cfg.headers;
        return { status: 200, data: { ok: true }, headers: {} };
      }
      return { status: 200, data: {}, headers: {} };
    });
    await client.ready();
    const token = makeValidJwt({ sub: 'u1' });
    await (client as any).tokenManager.setTokens({ accessToken: token, refreshToken: 'r-1' });

    // App call — NOT through the adapter (untagged): the interceptor still runs.
    await axios.request({ url: `${BASE}/api/data`, method: 'get' });
    expect(appHeaders?.Authorization).toBe(`Bearer ${token}`);
  });

  it('default skipPaths: a 401 on the refresh endpoint is never refresh-retried', async () => {
    const { axios } = setup((cfg) => {
      throw makeAxiosError(401, cfg);
    });
    // Untagged direct call to the refresh endpoint: must not loop.
    await expect(axios.request({ url: `${BASE}/auth/refresh-token`, method: 'post' })).rejects.toBeTruthy();
    expect(axios.dispatchCount).toBe(1);
  });

  it('the adapter tag protects even with a CUSTOM refresh endpoint (default skips would not match)', async () => {
    const axios = new FakeAxios((cfg) => {
      const u = cfg.url as string;
      if (ends(u, '/auth/verify-session') || ends(u, '/custom/refresh')) throw makeAxiosError(401, cfg);
      return { status: 200, data: {}, headers: {} };
    });
    const client = new AuthClient({
      baseUrl: BASE,
      accessTokenType: 'header',
      storage: new MemoryStorage(),
      httpAdapter: createAxiosAdapter(axios),
      autoRefresh: true,
      endpoints: { refresh: '/custom/refresh' } as any,
    });
    client.attachToAxios(axios);
    await client.ready();
    await (client as any).tokenManager.setTokens({ accessToken: makeValidJwt({ sub: 'u1' }), refreshToken: 'r-1' });

    const result = await withTimeout(client.verifySession(), 1500);
    expect(result).not.toBe('TIMEOUT'); // only the request tag prevents the deadlock here
    expect((result as any).valid).toBe(false);
  });
});

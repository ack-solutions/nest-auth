/**
 * Real integration tests for the multi-account premise (header/bearer mode).
 *
 * The backend is multi-session by default: each login mints an independent
 * session and nothing revokes the others. "Multi-account" is therefore a CLIENT
 * concern — hold N token pairs, send whichever account's bearer you want. These
 * tests prove the server guarantees the SDK layer relies on:
 *   - the `session.allowMultipleAccounts` capability flag is surfaced on
 *     /auth/client-config so SDKs can enable an account switcher;
 *   - two accounts stay independently authenticated at once;
 *   - "switching" = choosing which bearer to send;
 *   - refresh and logout are per-account and don't disturb the others.
 *
 * (In ISOLATED tenant mode the same email in two tenants yields two distinct
 * users/sessions — the exact same independent-session situation proven here.)
 *
 * NO MOCKS.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

function tokensOf(body: any): { access: string; refresh: string } {
  return {
    access: body?.accessToken ?? body?.tokens?.accessToken,
    refresh: body?.refreshToken ?? body?.tokens?.refreshToken,
  };
}

async function signup(handle: TestAppHandle, email: string) {
  const res = await request(handle.httpServer)
    .post('/auth/signup')
    .send({ email, password: 'MultiAcct!1' });
  if (res.status >= 300) throw new Error(`signup ${email} failed: ${res.status} ${JSON.stringify(res.body)}`);
  return tokensOf(res.body);
}

const whoami = (handle: TestAppHandle, accessToken: string) =>
  request(handle.httpServer).get('/auth/user').set('Authorization', `Bearer ${accessToken}`);

describe('multi-account: client-config capability flag', () => {
  it('defaults to multipleAccounts.enabled = false', async () => {
    const handle = await bootTestApp();
    const res = await request(handle.httpServer).get('/auth/client-config');
    expect(res.status).toBe(200);
    expect(res.body.multipleAccounts).toEqual({ enabled: false });
    await handle.close();
  });

  it('reflects session.allowMultipleAccounts = true', async () => {
    const handle = await bootTestApp({ nestAuth: { session: { allowMultipleAccounts: true } as any } });
    const res = await request(handle.httpServer).get('/auth/client-config');
    expect(res.body.multipleAccounts).toEqual({ enabled: true });
    await handle.close();
  });
});

describe('multi-account premise: concurrent independent sessions, switch by bearer', () => {
  let handle: TestAppHandle;

  beforeAll(async () => {
    handle = await bootTestApp({ nestAuth: { session: { allowMultipleAccounts: true } as any } });
  });
  afterAll(async () => {
    await handle.close();
  });

  it('two accounts stay independently authenticated; the bearer selects the active account', async () => {
    const a = await signup(handle, 'acct-a@test.local');
    const b = await signup(handle, 'acct-b@test.local'); // the 2nd login must NOT disturb the 1st

    const meA = await whoami(handle, a.access);
    const meB = await whoami(handle, b.access);
    expect(meA.status).toBe(200);
    expect(meB.status).toBe(200);
    expect(meA.body.email).toBe('acct-a@test.local');
    expect(meB.body.email).toBe('acct-b@test.local');

    // "Switch account" === choose which token to send. A still works after B logged in.
    expect((await whoami(handle, a.access)).body.email).toBe('acct-a@test.local');
  });

  it('refreshing one account does not affect the other (per-session rotation)', async () => {
    const a = await signup(handle, 'acct-ra@test.local');
    const b = await signup(handle, 'acct-rb@test.local');

    const refreshed = await request(handle.httpServer)
      .post('/auth/refresh-token')
      .send({ refreshToken: a.refresh });
    expect(refreshed.status).toBeLessThan(300);
    const aNew = tokensOf(refreshed.body);
    expect(aNew.access).toBeTruthy();

    // A's refreshed token works; B's original token is untouched.
    expect((await whoami(handle, aNew.access)).body.email).toBe('acct-ra@test.local');
    expect((await whoami(handle, b.access)).body.email).toBe('acct-rb@test.local');
  });

  it('logging out one account revokes only that account; the other stays signed in', async () => {
    const a = await signup(handle, 'acct-la@test.local');
    const b = await signup(handle, 'acct-lb@test.local');

    const out = await request(handle.httpServer)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${a.access}`)
      .send({});
    expect(out.status).toBeLessThan(300);

    // A revoked → 401; B unaffected.
    expect((await whoami(handle, a.access)).status).toBe(401);
    expect((await whoami(handle, b.access)).body.email).toBe('acct-lb@test.local');
  });
});

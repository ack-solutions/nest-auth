/**
 * Real integration tests for COOKIE-mode multi-account (phase 2).
 *
 * In cookie mode a single cookie name can hold only one account's tokens, so the
 * server writes PER-ACCOUNT httpOnly cookies (accessToken_<userId> /
 * refreshToken_<userId>) plus a non-httpOnly selector cookie naming the active
 * account. The guard reads the selector to pick the active account's token;
 * "switching" is just changing the selector (client-side). A real browser is
 * simulated with a manual cookie jar over supertest. NO MOCKS.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { ACTIVE_ACCOUNT_COOKIE_NAME } from '../../src';

const PASSWORD = 'CookieMulti!1';
const EMAIL_A = 'ck-a@test.local';
const EMAIL_B = 'ck-b@test.local';

/** A minimal browser-like cookie jar: tracks Set-Cookie, drops deleted cookies. */
function makeJar() {
  const jar = new Map<string, string>();
  return {
    apply(res: request.Response) {
      const setCookies: string[] = (res.headers['set-cookie'] as unknown as string[]) || [];
      for (const sc of setCookies) {
        const [pair, ...attrs] = sc.split(';');
        const eq = pair.indexOf('=');
        const name = pair.slice(0, eq).trim();
        const value = pair.slice(eq + 1).trim();
        const attrStr = attrs.join(';').toLowerCase();
        const deleted =
          /max-age=0/.test(attrStr) || /expires=thu, 01 jan 1970/.test(attrStr) || value === '';
        if (deleted) jar.delete(name);
        else jar.set(name, value);
      }
    },
    header(): string {
      return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
    },
    set(name: string, value: string) {
      jar.set(name, value);
    },
    names(): string[] {
      return Array.from(jar.keys());
    },
  };
}

describe('cookie-mode multi-account — per-account cookies + selector', () => {
  let handle: TestAppHandle;
  const server = () => handle.httpServer;

  beforeAll(async () => {
    handle = await bootTestApp({
      nestAuth: {
        session: { allowMultipleAccounts: true, accessTokenType: 'cookie' } as any,
      },
    });
  });
  afterAll(async () => {
    await handle.close();
  });

  it('holds two accounts in one browser and the selector picks the active one', async () => {
    const jar = makeJar();

    // Sign up A → sets accessToken_<A>/refreshToken_<A> + selector=A.
    jar.apply(await request(server()).post('/auth/signup').set('Cookie', jar.header()).send({ email: EMAIL_A, password: PASSWORD }));
    // Sign up B (carrying A's cookies) → adds B's cookies + selector=B (active).
    jar.apply(await request(server()).post('/auth/signup').set('Cookie', jar.header()).send({ email: EMAIL_B, password: PASSWORD }));

    // The jar now holds BOTH accounts' per-account cookies.
    const names = jar.names();
    expect(names.filter((n) => n.startsWith('refreshToken_')).length).toBe(2);
    expect(names).toContain(ACTIVE_ACCOUNT_COOKIE_NAME);

    // Active is B (last login).
    let me = await request(server()).get('/auth/user').set('Cookie', jar.header());
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(EMAIL_B);

    // List accounts → both present, B active.
    const list = await request(server()).get('/auth/accounts').set('Cookie', jar.header());
    expect(list.status).toBe(200);
    const accA = list.body.accounts.find((a: any) => a.email === EMAIL_A);
    const accB = list.body.accounts.find((a: any) => a.email === EMAIL_B);
    expect(accA && accB).toBeTruthy();
    expect(accB.isActive).toBe(true);
    expect(accA.isActive).toBe(false);

    // Switch to A by changing the selector (what the browser SDK does — no server call).
    jar.set(ACTIVE_ACCOUNT_COOKIE_NAME, accA.accountId);
    me = await request(server()).get('/auth/user').set('Cookie', jar.header());
    expect(me.body.email).toBe(EMAIL_A);

    // /accounts reflects the switch.
    const list2 = await request(server()).get('/auth/accounts').set('Cookie', jar.header());
    expect(list2.body.accounts.find((a: any) => a.email === EMAIL_A).isActive).toBe(true);
  });

  it('refresh rotates only the active account; logout clears just that account and promotes another', async () => {
    const jar = makeJar();
    jar.apply(await request(server()).post('/auth/signup').set('Cookie', jar.header()).send({ email: 'ck-r1@test.local', password: PASSWORD }));
    jar.apply(await request(server()).post('/auth/signup').set('Cookie', jar.header()).send({ email: 'ck-r2@test.local', password: PASSWORD }));
    // active = r2

    // Refresh the active account via cookies (no body) → rotates r2, still authenticated.
    const refreshed = await request(server()).post('/auth/refresh-token').set('Cookie', jar.header()).send({});
    expect(refreshed.status).toBeLessThan(300);
    jar.apply(refreshed);
    let me = await request(server()).get('/auth/user').set('Cookie', jar.header());
    expect(me.body.email).toBe('ck-r2@test.local');

    // Logout the active account → clears r2's cookies, promotes r1.
    const out = await request(server()).post('/auth/logout').set('Cookie', jar.header()).send({});
    expect(out.status).toBeLessThan(300);
    jar.apply(out);

    me = await request(server()).get('/auth/user').set('Cookie', jar.header());
    expect(me.body.email).toBe('ck-r1@test.local'); // promoted to the other account

    const list = await request(server()).get('/auth/accounts').set('Cookie', jar.header());
    expect(list.body.accounts.map((a: any) => a.email)).toEqual(['ck-r1@test.local']);
  });

  it('/auth/accounts is empty when multi-account is disabled', async () => {
    const single = await bootTestApp({ nestAuth: { session: { accessTokenType: 'cookie' } as any } });
    const res = await request(single.httpServer).get('/auth/accounts');
    expect(res.status).toBe(200);
    expect(res.body.accounts).toEqual([]);
    await single.close();
  });
});

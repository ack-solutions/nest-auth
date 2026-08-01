/**
 * Regression tests for disposable/blocked email-domain screening + admin CRUD.
 *
 * NO MOCKS. Real NestJS + real DB. A real admin session drives the management
 * API; sign-up enforcement reads the same DB blocklist.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

const SECRET = 'disposable-domains-admin-secret-key-01'; // 32+ chars
const ADMIN_PW = 'AdminPass!1word';
const BASE = '/auth/admin/api/blocked-email-domains';

describe('disposable / blocked email domains', () => {
  let handle: TestAppHandle;

  beforeEach(async () => {
    handle = await bootTestApp({
      nestAuth: {
        emailAuth: { enabled: true, disposable: { enabled: true } },
        adminConsole: { enabled: true, secretKey: SECRET },
      } as any,
    });
  });
  afterEach(async () => { await handle.close(); });

  /** Bootstrap an admin and return its session Cookie header. */
  async function adminCookie(): Promise<string> {
    await request(handle.httpServer).post('/auth/admin/signup').send({ email: 'dd-admin@test.local', password: ADMIN_PW, secretKey: SECRET });
    const login = await request(handle.httpServer).post('/auth/admin/login').send({ email: 'dd-admin@test.local', password: ADMIN_PW });
    const set = login.headers['set-cookie'];
    return (Array.isArray(set) ? set : [set]).map((c) => c.split(';')[0]).join('; ');
  }

  it('blocks signup from a blocklisted domain, allows others, and unblocks on delete', async () => {
    const cookie = await adminCookie();

    // Add a domain via the admin API.
    const add = await request(handle.httpServer).post(BASE).set('Cookie', cookie).send({ domains: ['Mailinator.com'] });
    expect(add.status).toBeLessThan(300);
    expect(add.body.added).toBe(1);

    // Signup with the blocked domain → 403 EMAIL_DOMAIN_NOT_ALLOWED.
    const blocked = await request(handle.httpServer).post('/auth/signup').send({ email: 'x@mailinator.com', password: 'GoodPass!1' });
    expect(blocked.status).toBe(403);
    expect(JSON.stringify(blocked.body)).toContain('EMAIL_DOMAIN_NOT_ALLOWED');

    // Signup with an allowed domain → ok.
    const ok = await request(handle.httpServer).post('/auth/signup').send({ email: 'y@gmail.com', password: 'GoodPass!1' });
    expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);

    // Search finds it; delete unblocks it.
    const listed = await request(handle.httpServer).get(`${BASE}?search=mailin`).set('Cookie', cookie);
    expect(listed.status).toBe(200);
    expect(listed.body.data.some((d: any) => d.domain === 'mailinator.com')).toBe(true);

    const del = await request(handle.httpServer).delete(`${BASE}/mailinator.com`).set('Cookie', cookie);
    expect(del.status).toBeLessThan(300);

    const nowOk = await request(handle.httpServer).post('/auth/signup').send({ email: 'z@mailinator.com', password: 'GoodPass!1' });
    expect(nowOk.status, JSON.stringify(nowOk.body)).toBeLessThan(300);
  });

  it('imports the built-in default list', async () => {
    const cookie = await adminCookie();

    const stats0 = await request(handle.httpServer).get(`${BASE}/stats`).set('Cookie', cookie);
    expect(stats0.status).toBe(200);
    expect(stats0.body.defaultCount).toBeGreaterThan(8000);

    const imp = await request(handle.httpServer).post(`${BASE}/import-defaults`).set('Cookie', cookie).send({});
    expect(imp.status).toBeLessThan(300);
    expect(imp.body.imported).toBeGreaterThan(8000);

    // A well-known disposable brand from the default list is now blocked.
    const blocked = await request(handle.httpServer).post('/auth/signup').send({ email: 'a@guerrillamail.com', password: 'GoodPass!1' });
    expect(blocked.status).toBe(403);
  });

  it('requires an admin session for the management API', async () => {
    const res = await request(handle.httpServer).get(BASE);
    expect(res.status).toBe(401);
  });
});

/**
 * Real integration tests for ISOLATED tenant identity scoping.
 *
 * In ISOLATED mode the SAME email is a DISTINCT account per tenant. This proves:
 *   - two signups with the same email in different tenants are different users;
 *   - forgot-password resolves the account in the REQUESTED tenant (the bug:
 *     findIdentity was called without the resolved tenantId, so it could target
 *     the wrong same-email account);
 *   - the public GET /auth/tenants/lookup?slug= resolves a slug to its tenantId
 *     (so an ISOLATED login form can supply the right tenantId).
 *
 * NO MOCKS — real DB, real OTP machinery; the target user is read off the
 * emitted password-reset event.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { TenantModeEnum } from '@ackplus/nest-auth-contracts';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { attachEventCapture, type EventCapture } from '../helpers/event-capture';
import { TenantService, UserService } from '../../src';

const PASSWORD = 'IsoTenant!1';
const EMAIL = 'dup@test.local';

const tokenOf = (body: any): string => body?.accessToken ?? body?.tokens?.accessToken;
const subOf = (accessToken: string): string =>
  JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8')).sub;

describe('ISOLATED tenant — same email is a separate account per tenant', () => {
  let handle: TestAppHandle;
  let events: EventCapture;
  let acmeId: string;
  let globexId: string;
  let acmeUserId: string;
  let globexUserId: string;

  beforeAll(async () => {
    handle = await bootTestApp({
      nestAuth: { tenant: { enabled: true, mode: TenantModeEnum.ISOLATED } as any },
    });
    events = attachEventCapture(handle);

    const tenants = handle.get<TenantService>(TenantService);
    acmeId = (await tenants.createTenant({ slug: 'acme', name: 'Acme Inc' })).id!;
    globexId = (await tenants.createTenant({ slug: 'globex', name: 'Globex' })).id!;

    const a = await request(handle.httpServer).post('/auth/signup').send({ email: EMAIL, password: PASSWORD, tenantId: acmeId });
    expect(a.status, JSON.stringify(a.body)).toBeLessThan(300);
    acmeUserId = subOf(tokenOf(a.body));

    const b = await request(handle.httpServer).post('/auth/signup').send({ email: EMAIL, password: PASSWORD, tenantId: globexId });
    expect(b.status, JSON.stringify(b.body)).toBeLessThan(300);
    globexUserId = subOf(tokenOf(b.body));
  }, 60_000);

  afterAll(async () => {
    await handle.close();
  });

  it('the same email yields two DISTINCT users across tenants', () => {
    expect(acmeUserId).toBeTruthy();
    expect(globexUserId).toBeTruthy();
    expect(acmeUserId).not.toBe(globexUserId);
  });

  // Both directions: an UNSCOPED lookup returns the same same-email user for
  // both requests, so checking each tenant deterministically catches the bug.
  const resetTargetFor = async (tenantId: string): Promise<string | undefined> => {
    events.clear();
    const res = await request(handle.httpServer).post('/auth/forgot-password').send({ email: EMAIL, tenantId });
    expect(res.status).toBeLessThan(300);
    const ev = events.all().reverse().find((e) => /reset/i.test(e.name) && /request/i.test(e.name));
    return (ev?.payload?.user ?? ev?.payload?.payload?.user)?.id;
  };

  it('forgot-password targets the account in the REQUESTED tenant (acme)', async () => {
    expect(await resetTargetFor(acmeId)).toBe(acmeUserId);
  });

  it('forgot-password targets the account in the REQUESTED tenant (globex)', async () => {
    expect(await resetTargetFor(globexId)).toBe(globexUserId);
  });

  it('public tenant lookup resolves a slug to its id and 404s on unknown', async () => {
    const ok = await request(handle.httpServer).get('/auth/tenants/lookup').query({ slug: 'acme' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ id: acmeId, slug: 'acme', name: 'Acme Inc' });

    const missing = await request(handle.httpServer).get('/auth/tenants/lookup').query({ slug: 'does-not-exist' });
    expect(missing.status).toBe(404);
  });

  it('UserService.getTenantsByEmail returns every tenant that email belongs to', async () => {
    const users = handle.get(UserService);
    const tenants = await users.getTenantsByEmail(EMAIL);
    expect(tenants.map((t) => t.id).sort()).toEqual([acmeId, globexId].sort());
    expect(tenants.every((t) => t.slug && t.name)).toBe(true);

    expect(await users.getTenantsByEmail('nobody@test.local')).toEqual([]);
    expect(await users.getTenantsByEmail('')).toEqual([]);
  });
});

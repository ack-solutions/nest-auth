/**
 * Real integration tests for tenant modes.
 *
 * NO MOCKS. Boots the app in DISABLED and SHARED tenant modes and verifies the
 * documented behaviour.
 *
 * Covers: TC-017 (switchTenant rejected in DISABLED), TC-018 (DISABLED rejects
 * tenantId), TC-230..234 (DISABLED), TC-250+ (SHARED basics).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { TenantModeEnum } from '@ackplus/nest-auth-contracts';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

const RANDOM_UUID = '123e4567-e89b-12d3-a456-426614174000';

function tokenOf(body: any): string {
  const t = body?.accessToken ?? body?.tokens?.accessToken;
  if (!t) throw new Error(`no token: ${JSON.stringify(body)}`);
  return t;
}

describe('DISABLED tenant mode (default) — TC-017, TC-018, TC-230..234', () => {
  let handle: TestAppHandle;

  beforeAll(async () => {
    // bootTestApp default does NOT enable tenants → DISABLED mode
    handle = await bootTestApp();
  });

  afterAll(async () => {
    await handle.close();
  });

  it('TC-018: signup with a tenantId is rejected (DISABLED mode discards/forbids tenantId)', async () => {
    const res = await request(handle.httpServer)
      .post('/auth/signup')
      .send({ email: 'disabled-tenant@test.local', password: 'TenantPass!1', tenantId: RANDOM_UUID });

    // Per .tasks/018 fix, DISABLED mode rejects an explicit tenantId rather than
    // silently discarding it.
    expect(res.status).toBe(400);
  });

  it('signup WITHOUT tenantId works normally in DISABLED mode', async () => {
    const res = await request(handle.httpServer)
      .post('/auth/signup')
      .send({ email: 'disabled-ok@test.local', password: 'TenantPass!1' });
    expect(res.status).toBeLessThan(300);
  });

  it('TC-017: switch-tenant is rejected in DISABLED mode', async () => {
    const signup = await request(handle.httpServer)
      .post('/auth/signup')
      .send({ email: 'disabled-switch@test.local', password: 'TenantPass!1' });
    const token = tokenOf(signup.body);

    const res = await request(handle.httpServer)
      .post('/auth/switch-tenant')
      .set('Authorization', `Bearer ${token}`)
      .send({ tenantId: RANDOM_UUID });

    // Mode guard: switching tenants makes no sense when tenancy is disabled.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('switch-tenant requires auth → 401 without token', async () => {
    const res = await request(handle.httpServer)
      .post('/auth/switch-tenant')
      .send({ tenantId: RANDOM_UUID });
    expect(res.status).toBe(401);
  });
});

describe('SHARED tenant mode — TC-250+', () => {
  let handle: TestAppHandle;

  beforeAll(async () => {
    handle = await bootTestApp({
      nestAuth: {
        tenant: { enabled: true, mode: TenantModeEnum.SHARED } as any,
      },
    });
  });

  afterAll(async () => {
    await handle.close();
  });

  it('boots in SHARED mode and basic signup works', async () => {
    const res = await request(handle.httpServer)
      .post('/auth/signup')
      .send({ email: 'shared-user@test.local', password: 'SharedPass!1' });

    if (res.status >= 400) {
      // eslint-disable-next-line no-console
      console.error('[shared signup]', res.status, JSON.stringify(res.body, null, 2));
    }
    expect(res.status).toBeLessThan(300);
  });

  it('switch-tenant to a non-member tenant → 4xx (membership enforced)', async () => {
    const signup = await request(handle.httpServer)
      .post('/auth/signup')
      .send({ email: 'shared-switch@test.local', password: 'SharedPass!1' });
    const token = tokenOf(signup.body);

    const res = await request(handle.httpServer)
      .post('/auth/switch-tenant')
      .set('Authorization', `Bearer ${token}`)
      .send({ tenantId: RANDOM_UUID });

    // User is not a member of RANDOM_UUID tenant → forbidden / bad request.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

/**
 * Real integration tests for tenant-less PLATFORM (super-admin) user
 * provisioning under ISOLATED tenant mode (plus a SHARED-mode collision guard).
 *
 * Regression: in ISOLATED mode the public UserService had no tenant-less path
 * to provision/look up a platform super-admin — `createUser` / `getUserByEmail`
 * hard-require a tenantId (BadRequest TENANT_ID_REQUIRED), so an admin-bootstrap
 * that provisions a NestAuthPlatformAccess super-admin threw on every boot.
 *
 * The fix adds first-class, tenant-less `createPlatformUser(data)` /
 * `getPlatformUserByEmail(email)`. A "platform user" is identified by the
 * `NestAuthPlatformAccess` marker (the same row the login path enforces) — NOT
 * merely a tenant-less userAccess — so the lookup is correct in every tenant
 * mode. This proves:
 *   - the plain (tenant-scoped) API still throws TENANT_ID_REQUIRED under ISOLATED;
 *   - the platform API provisions + looks up a tenant-less account (with both a
 *     tenant-less userAccess AND a NestAuthPlatformAccess marker) with no tenantId;
 *   - the lookup never returns a same-email TENANT user (the core scoping guard);
 *   - a platform user co-exists with a same-email tenant account;
 *   - the full AdminBootstrap shape works (createPlatformUser → getPlatformAccess
 *     → assignRoles);
 *   - email AND phone duplicate provisioning are conflict-guarded;
 *   - in SHARED mode, getPlatformUserByEmail does NOT return a regular
 *     (tenant-less) user — only a real platform-access holder.
 *
 * NO MOCKS — real DB, real services.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { TenantModeEnum } from '@ackplus/nest-auth-contracts';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { UserService, RoleService, TenantService } from '../../src';

const PLATFORM_EMAIL = 'super-admin@platform.local';
const PLATFORM_PHONE = '+15550100200';
const SHARED_EMAIL = 'shared@test.local';
const TENANT_PASSWORD = 'IsoTenant!1';

const subOf = (body: any): string =>
  JSON.parse(
    Buffer.from((body?.accessToken ?? body?.tokens?.accessToken).split('.')[1], 'base64url').toString('utf8'),
  ).sub;

describe('ISOLATED tenant — tenant-less platform (super-admin) user provisioning', () => {
  let handle: TestAppHandle;
  let users: UserService;
  let roles: RoleService;
  let acmeId: string;
  let acmeUserId: string;

  beforeAll(async () => {
    handle = await bootTestApp({
      nestAuth: { tenant: { enabled: true, mode: TenantModeEnum.ISOLATED } as any },
    });
    users = handle.get<UserService>(UserService);
    roles = handle.get<RoleService>(RoleService);

    const tenants = handle.get<TenantService>(TenantService);
    acmeId = (await tenants.createTenant({ slug: 'acme', name: 'Acme Inc' })).id!;

    // A normal tenant user with SHARED_EMAIL — proves (a) a platform lookup must
    // NOT return it, and (b) a platform user can later be provisioned with the
    // SAME email without colliding with this account.
    const a = await request(handle.httpServer)
      .post('/auth/signup')
      .send({ email: SHARED_EMAIL, password: TENANT_PASSWORD, tenantId: acmeId });
    expect(a.status, JSON.stringify(a.body)).toBeLessThan(300);
    acmeUserId = subOf(a.body);
  }, 60_000);

  afterAll(async () => {
    await handle.close();
  });

  it('the plain tenant-scoped API still requires a tenantId under ISOLATED', async () => {
    await expect(users.getUserByEmail(PLATFORM_EMAIL)).rejects.toMatchObject({
      response: { code: 'TENANT_ID_REQUIRED' },
    });
    await expect(users.createUser({ email: PLATFORM_EMAIL, isActive: true })).rejects.toMatchObject({
      response: { code: 'TENANT_ID_REQUIRED' },
    });
  });

  it('getPlatformUserByEmail returns null (no throw) when none exists', async () => {
    await expect(users.getPlatformUserByEmail(PLATFORM_EMAIL)).resolves.toBeNull();
  });

  it('getPlatformUserByEmail does NOT return a same-email TENANT user (core scoping guard)', async () => {
    // A tenant user with SHARED_EMAIL exists (acme), but NO platform user does
    // yet. The lookup must resolve to null — it keys off the platform-access
    // marker, not the email alone. This is the deterministic regression guard:
    // dropping the platform scoping would return the acme tenant user here.
    await expect(users.getPlatformUserByEmail(SHARED_EMAIL)).resolves.toBeNull();
  });

  it('createPlatformUser provisions a tenant-less account with the platform marker', async () => {
    const created = await users.createPlatformUser({ email: PLATFORM_EMAIL, isActive: true });
    expect(created.id).toBeTruthy();

    const found = await users.getPlatformUserByEmail(PLATFORM_EMAIL);
    expect(found?.id).toBe(created.id);

    // It got a tenant-less userAccess (tenantId NULL) AND a platform-access row.
    expect(found?.userAccesses?.length).toBe(1);
    expect(found?.userAccesses?.[0]?.tenantId ?? null).toBeNull();
    expect(found?.platformAccess).toBeTruthy();
  });

  it('a platform user co-exists with a same-email tenant account', async () => {
    // SHARED_EMAIL already belongs to a tenant (acme) user. Provisioning a
    // platform user with the same email must NOT collide and must yield a
    // DISTINCT account; the lookup must resolve to the platform one.
    const platformDup = await users.createPlatformUser({ email: SHARED_EMAIL, isActive: true });
    expect(platformDup.id).toBeTruthy();
    expect(platformDup.id).not.toBe(acmeUserId);

    const found = await users.getPlatformUserByEmail(SHARED_EMAIL);
    expect(found?.id).toBe(platformDup.id);
    expect(found?.id).not.toBe(acmeUserId);
    expect(found?.platformAccess).toBeTruthy();
  });

  it('mirrors AdminBootstrap end-to-end: createPlatformUser → getPlatformAccess → assignRoles', async () => {
    const role = await roles.createRole('platform-super-admin', null, null, true);

    const user = await users.getPlatformUserByEmail(PLATFORM_EMAIL);
    expect(user).toBeTruthy();

    const access = await user!.getPlatformAccess(true);
    await access.assignRoles([role.id]);

    const assigned = await access.getRoles();
    expect(assigned.map((r) => r.id)).toContain(role.id);
  });

  it('duplicate platform provisioning is conflict-guarded (email)', async () => {
    await expect(users.createPlatformUser({ email: PLATFORM_EMAIL, isActive: true })).rejects.toMatchObject({
      response: { code: 'USER_ALREADY_EXISTS' },
    });
  });

  it('duplicate platform provisioning is conflict-guarded (phone)', async () => {
    const created = await users.createPlatformUser({ phone: PLATFORM_PHONE, isActive: true });
    expect(created.id).toBeTruthy();
    await expect(users.createPlatformUser({ phone: PLATFORM_PHONE, isActive: true })).rejects.toMatchObject({
      response: { code: 'USER_ALREADY_EXISTS' },
    });
  });

  it('getPlatformUsers lists only platform-marker users (not tenant users) + count + by-role', async () => {
    // By now several platform users exist (PLATFORM_EMAIL, the same-email platform
    // account, PLATFORM_PHONE) plus one tenant user (acme, SHARED_EMAIL).
    const platformUsers = await users.getPlatformUsers({
      relations: ['platformAccess', 'userAccesses'],
    });
    expect(platformUsers.length).toBeGreaterThanOrEqual(3);
    expect(platformUsers.every((u) => !!u.platformAccess)).toBe(true);
    // the tenant user is NOT returned
    expect(platformUsers.some((u) => u.id === acmeUserId)).toBe(false);

    // count matches, and never includes the tenant user
    const [, total] = await users.getPlatformUsersAndCount({ take: 100 });
    expect(total).toBe(platformUsers.length);

    // the super-admin role assigned earlier resolves via platformAccess.roles
    const admins = await users.getPlatformUsersByRole('platform-super-admin');
    const target = await users.getPlatformUserByEmail(PLATFORM_EMAIL);
    expect(admins.some((u) => u.id === target?.id)).toBe(true);
    expect(admins.every((u) => !!u.platformAccess)).toBe(true);
  });
});

describe('SHARED tenant — getPlatformUserByEmail keys off the platform marker, not tenant-less access', () => {
  let handle: TestAppHandle;
  let users: UserService;

  beforeAll(async () => {
    handle = await bootTestApp({
      nestAuth: { tenant: { enabled: true, mode: TenantModeEnum.SHARED } as any },
    });
    users = handle.get<UserService>(UserService);

    // A regular SHARED user signed up WITHOUT a tenant → gets a tenant-less
    // userAccess (tenantId NULL) but NO platform access.
    const r = await request(handle.httpServer)
      .post('/auth/signup')
      .send({ email: 'regular@shared.local', password: TENANT_PASSWORD });
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
  }, 60_000);

  afterAll(async () => {
    await handle.close();
  });

  it('does NOT return a regular tenant-less user as if it were a platform user', async () => {
    // Pre-fix this returned the regular user (tenant-less access collision).
    await expect(users.getPlatformUserByEmail('regular@shared.local')).resolves.toBeNull();
  });

  it('returns a real platform-access holder', async () => {
    const created = await users.createPlatformUser({ email: 'admin@shared.local', isActive: true });
    const found = await users.getPlatformUserByEmail('admin@shared.local');
    expect(found?.id).toBe(created.id);
    expect(found?.platformAccess).toBeTruthy();
  });
});

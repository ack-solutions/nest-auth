/**
 * Real integration tests for managing PLATFORM (super-admin) users from the
 * admin console API.
 *
 * Background: platform access and tenant access are two INDEPENDENT scopes on
 * the same `NestAuthUser` row:
 *   - `NestAuthPlatformAccess`  — tenant-less 1:1 marker, carries platform-wide
 *     roles. Its presence is what makes a user a "platform user".
 *   - `NestAuthUserAccess`      — one row per tenant (plus at most one
 *     tenant-less/global row), each carrying that tenant's roles.
 * A user may hold both, either, or neither — nothing in the schema couples them.
 *
 * Before this, the admin console dropped `platformAccess` from every response,
 * so the UI could not tell a platform user apart from a tenant user and offered
 * no way to manage platform roles at all. These tests pin the fix:
 *   - both scopes are hydrated and returned, and stay separate;
 *   - `?scope=platform|tenant|all` filters the list by access scope;
 *   - `platformRoleIds` sets platform roles WITHOUT touching tenant roles;
 *   - `platformRoleIds` on a non-platform user is refused (roles-only design —
 *     the console never mints super-admins).
 *
 * NO MOCKS — real NestJS app, real DB, real admin session cookie.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { TenantModeEnum } from '@ackplus/nest-auth-contracts';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { UserService, RoleService, TenantService } from '../../src';

const SECRET = 'platform-users-admin-secret-key-000001'; // 32+ chars
const ADMIN_PW = 'AdminPass!1word';

const PLATFORM_ONLY_EMAIL = 'platform-only@platform.local';
const HYBRID_EMAIL = 'hybrid@platform.local';
const TENANT_ONLY_EMAIL = 'tenant-only@test.local';

describe('Admin console — platform user management', () => {
  let handle: TestAppHandle;
  let users: UserService;
  let roles: RoleService;
  let cookie: string;

  let acmeId: string;
  let globexId: string;

  let platformOnlyId: string;
  let hybridId: string;
  let tenantOnlyId: string;

  let superAdminRoleId: string;
  let platformAuditorRoleId: string;
  let tenantRoleId: string;

  const ADMIN_API = '/auth/admin';
  const get = (path: string) => request(handle.httpServer).get(`${ADMIN_API}${path}`).set('Cookie', cookie);
  const patch = (path: string) => request(handle.httpServer).patch(`${ADMIN_API}${path}`).set('Cookie', cookie);

  beforeAll(async () => {
    handle = await bootTestApp({
      nestAuth: {
        adminConsole: { enabled: true, secretKey: SECRET },
        // SHARED so one user can hold several tenant memberships alongside
        // platform access — the exact combination the detail page must show.
        tenant: { enabled: true, mode: TenantModeEnum.SHARED },
        platformAccess: { enabled: true },
      } as any,
    });

    users = handle.get<UserService>(UserService);
    roles = handle.get<RoleService>(RoleService);
    const tenants = handle.get<TenantService>(TenantService);

    acmeId = (await tenants.createTenant({ slug: 'acme', name: 'Acme Inc' })).id!;
    globexId = (await tenants.createTenant({ slug: 'globex', name: 'Globex' })).id!;

    // Global (tenant-less) roles — the pool platform roles are drawn from.
    superAdminRoleId = (await roles.createRole('platform-super-admin', null, null, true)).id;
    platformAuditorRoleId = (await roles.createRole('platform-auditor', null, null, true)).id;
    // A tenant-scoped role, to prove the two scopes never bleed into each other.
    tenantRoleId = (await roles.createRole('acme-editor', null, acmeId, false)).id;

    // 1. platform-only user
    platformOnlyId = (await users.createPlatformUser({ email: PLATFORM_ONLY_EMAIL, isActive: true })).id;

    // 2. HYBRID user — platform access AND two tenant memberships at once.
    const hybrid = await users.createPlatformUser({ email: HYBRID_EMAIL, isActive: true });
    hybridId = hybrid.id;
    await users.setUserAccessRoles(hybridId, acmeId, [tenantRoleId]);
    await users.setUserAccessRoles(hybridId, globexId, []);

    // 3. tenant-only user (no platform marker)
    tenantOnlyId = (await users.createUser({ email: TENANT_ONLY_EMAIL, isActive: true }, acmeId)).id;

    // Admin console session.
    await request(handle.httpServer)
      .post('/auth/admin/signup')
      .send({ email: 'console@test.local', password: ADMIN_PW, secretKey: SECRET });
    const login = await request(handle.httpServer)
      .post('/auth/admin/login')
      .send({ email: 'console@test.local', password: ADMIN_PW });
    const setCookie = login.headers['set-cookie'];
    cookie = (Array.isArray(setCookie) ? setCookie : [setCookie]).map((c) => c.split(';')[0]).join('; ');
    expect(cookie).toBeTruthy();
  });

  afterAll(async () => {
    await handle.close();
  });

  it('a user can hold platform access AND multiple tenant memberships at once', async () => {
    const res = await get(`/api/users/${hybridId}`);
    expect(res.status).toBe(200);

    const user = res.body.user;
    // Platform scope present...
    expect(user.isPlatformUser).toBe(true);
    expect(user.platformAccess).toBeTruthy();
    // ...alongside two independent tenant memberships.
    const tenantIds = (user.userAccesses ?? []).map((a: any) => a.tenantId).filter(Boolean).sort();
    expect(tenantIds).toEqual([acmeId, globexId].sort());
  });

  it('list hydrates both access scopes and marks platform users', async () => {
    const res = await get('/api/users?limit=100');
    expect(res.status).toBe(200);
    expect(res.body.meta.scope).toBe('all');

    const byId = new Map(res.body.data.map((u: any) => [u.id, u]));
    expect((byId.get(platformOnlyId) as any).isPlatformUser).toBe(true);
    expect((byId.get(hybridId) as any).isPlatformUser).toBe(true);
    expect((byId.get(tenantOnlyId) as any).isPlatformUser).toBe(false);
    expect((byId.get(tenantOnlyId) as any).platformAccess).toBeNull();
  });

  it('?scope=platform returns only platform users', async () => {
    const res = await get('/api/users?scope=platform&limit=100');
    expect(res.status).toBe(200);
    expect(res.body.meta.scope).toBe('platform');

    const ids = res.body.data.map((u: any) => u.id);
    expect(ids).toContain(platformOnlyId);
    expect(ids).toContain(hybridId);
    expect(ids).not.toContain(tenantOnlyId);
    expect(res.body.data.every((u: any) => u.isPlatformUser === true)).toBe(true);
    // total must reflect the filtered set, not every user.
    expect(res.body.meta.total).toBe(ids.length);
  });

  it('?scope=tenant excludes platform users', async () => {
    const res = await get('/api/users?scope=tenant&limit=100');
    expect(res.status).toBe(200);
    expect(res.body.meta.scope).toBe('tenant');

    const ids = res.body.data.map((u: any) => u.id);
    expect(ids).toContain(tenantOnlyId);
    expect(ids).not.toContain(platformOnlyId);
    expect(ids).not.toContain(hybridId);
    expect(res.body.data.every((u: any) => u.isPlatformUser === false)).toBe(true);
    expect(res.body.meta.total).toBe(ids.length);
  });

  it('an unrecognized scope falls back to all', async () => {
    const res = await get('/api/users?scope=nonsense&limit=100');
    expect(res.status).toBe(200);
    expect(res.body.meta.scope).toBe('all');
    expect(res.body.data.map((u: any) => u.id)).toContain(tenantOnlyId);
  });

  it('platformRoleIds sets platform roles without touching tenant roles', async () => {
    const res = await patch(`/api/users/${hybridId}`).send({
      platformRoleIds: [superAdminRoleId, platformAuditorRoleId],
    });
    expect(res.status).toBeLessThan(300);

    const detail = await get(`/api/users/${hybridId}`);
    const user = detail.body.user;

    // Platform scope got the platform roles.
    const platformRoleNames = (user.platformAccess?.roles ?? []).map((r: any) => r.name).sort();
    expect(platformRoleNames).toEqual(['platform-auditor', 'platform-super-admin']);

    // Tenant scope is untouched — acme still has only its own role, and no
    // platform role leaked into any tenant access.
    const acme = (user.userAccesses ?? []).find((a: any) => a.tenantId === acmeId);
    expect((acme.roles ?? []).map((r: any) => r.name)).toEqual(['acme-editor']);
    const allTenantRoleNames = (user.userAccesses ?? []).flatMap((a: any) =>
      (a.roles ?? []).map((r: any) => r.name),
    );
    expect(allTenantRoleNames).not.toContain('platform-super-admin');
  });

  it('platform roles can be replaced and cleared', async () => {
    await patch(`/api/users/${platformOnlyId}`).send({ platformRoleIds: [superAdminRoleId] });
    let detail = await get(`/api/users/${platformOnlyId}`);
    expect((detail.body.user.platformAccess.roles ?? []).map((r: any) => r.name)).toEqual([
      'platform-super-admin',
    ]);

    // Replace
    await patch(`/api/users/${platformOnlyId}`).send({ platformRoleIds: [platformAuditorRoleId] });
    detail = await get(`/api/users/${platformOnlyId}`);
    expect((detail.body.user.platformAccess.roles ?? []).map((r: any) => r.name)).toEqual([
      'platform-auditor',
    ]);

    // Clear
    await patch(`/api/users/${platformOnlyId}`).send({ platformRoleIds: [] });
    detail = await get(`/api/users/${platformOnlyId}`);
    expect(detail.body.user.platformAccess.roles ?? []).toEqual([]);
    // Clearing roles must NOT remove the platform marker.
    expect(detail.body.user.isPlatformUser).toBe(true);
  });

  it('platformRoleIds on a non-platform user is refused (console never mints super-admins)', async () => {
    const res = await patch(`/api/users/${tenantOnlyId}`).send({
      platformRoleIds: [superAdminRoleId],
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('NOT_PLATFORM_USER');

    // And it stayed a non-platform user.
    const detail = await get(`/api/users/${tenantOnlyId}`);
    expect(detail.body.user.isPlatformUser).toBe(false);
  });

  it('scope filter composes with search', async () => {
    const res = await get(`/api/users?scope=platform&search=hybrid&limit=100`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((u: any) => u.id);
    expect(ids).toEqual([hybridId]);
  });
});

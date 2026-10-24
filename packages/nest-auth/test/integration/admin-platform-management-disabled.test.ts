/**
 * Regression for ack-solutions/nest-auth#10: `adminConsole.allowPlatformUserManagement: false`.
 *
 * An app that needs platform access for its own admin sign-in, but manages
 * platform users in its own UI, must be able to keep that power out of the
 * bundled console. Before this option, whoever held the console secret could
 * make any account a platform (super-admin) user. With it off:
 *   - creating a platform user, granting/revoking access and setting platform
 *     roles all answer 403 PLATFORM_USER_MANAGEMENT_DISABLED and write nothing;
 *   - an existing platform user can't be edited, have its MFA device removed or
 *     be deleted (any of those is a takeover or a lock-out by another route);
 *   - tenant users, listing and viewing stay available;
 *   - `/config` reports the switch so the UI can hide the controls.
 *
 * NO MOCKS — real NestJS app, real DB, real admin session cookie.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { UserService, RoleService } from '../../src';

const SECRET = 'platform-mgmt-off-admin-secret-key-0001'; // 32+ chars
const ADMIN_PW = 'AdminPass!1word';
const ADMIN_API = '/auth/admin';

describe('Admin console — allowPlatformUserManagement: false', () => {
  let handle: TestAppHandle;
  let users: UserService;
  let cookie: string;
  let platformUserId: string;
  let tenantUserId: string;
  let platformRoleId: string;

  const api = () => request(handle.httpServer);
  const withCookie = <T extends { set: (k: string, v: string) => T }>(r: T) => r.set('Cookie', cookie);

  beforeAll(async () => {
    handle = await bootTestApp({
      nestAuth: {
        adminConsole: { enabled: true, secretKey: SECRET, allowPlatformUserManagement: false },
        platformAccess: { enabled: true },
      } as any,
    });
    users = handle.get<UserService>(UserService);
    const roles = handle.get<RoleService>(RoleService);

    platformRoleId = (await roles.createRole('platform-operator', null, null, true)).id;
    platformUserId = (await users.createPlatformUser({ email: 'existing-platform@test.local', isActive: true })).id;
    tenantUserId = (await users.createUser({ email: 'plain@test.local', isActive: true })).id;

    await api().post(`${ADMIN_API}/signup`).send({ email: 'console@test.local', password: ADMIN_PW, secretKey: SECRET });
    const login = await api().post(`${ADMIN_API}/login`).send({ email: 'console@test.local', password: ADMIN_PW });
    const setCookie = login.headers['set-cookie'];
    cookie = (Array.isArray(setCookie) ? setCookie : [setCookie]).map((c) => c.split(';')[0]).join('; ');
    expect(cookie).toBeTruthy();
  });

  afterAll(async () => {
    await handle?.close();
  });

  const expectRefused = (res: request.Response) => {
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).toContain('PLATFORM_USER_MANAGEMENT_DISABLED');
  };

  it('/config reports the switch to the UI', async () => {
    const res = await api().get(`${ADMIN_API}/config`);
    expect(res.status).toBe(200);
    expect(res.body.allowPlatformUserManagement).toBe(false);
  });

  it('refuses to create a platform user', async () => {
    const res = await withCookie(api().post(`${ADMIN_API}/api/users`)).send({
      email: 'minted@test.local',
      isPlatformUser: true,
    });
    expectRefused(res);
    expect(await users.getUserByEmail('minted@test.local')).toBeFalsy();
  });

  it('refuses to grant platform access to a tenant user, and writes nothing', async () => {
    const res = await withCookie(api().patch(`${ADMIN_API}/api/users/${tenantUserId}`)).send({
      isPlatformUser: true,
      platformRoleIds: [platformRoleId],
      metadata: { touched: true },
    });
    expectRefused(res);

    const user = await users.getUserById(tenantUserId);
    expect(await user!.getPlatformAccess(false)).toBeNull();
    expect((user as any).metadata?.touched).toBeUndefined();
  });

  it('refuses to revoke platform access or edit an existing platform user', async () => {
    expectRefused(await withCookie(api().patch(`${ADMIN_API}/api/users/${platformUserId}`)).send({ isPlatformUser: false }));
    expectRefused(await withCookie(api().patch(`${ADMIN_API}/api/users/${platformUserId}`)).send({ email: 'hijack@test.local' }));

    const user = await users.getUserById(platformUserId);
    expect(user!.email).toBe('existing-platform@test.local');
    expect(await user!.getPlatformAccess(false)).toBeTruthy();
  });

  it('refuses to delete a platform user or drop its MFA device', async () => {
    expectRefused(await withCookie(api().delete(`${ADMIN_API}/api/users/${platformUserId}`)));
    expectRefused(await withCookie(api().delete(`${ADMIN_API}/api/users/${platformUserId}/totp-devices/any-device`)));
    expect(await users.getUserById(platformUserId)).toBeTruthy();
  });

  it('still lists and shows platform users (read-only)', async () => {
    const list = await withCookie(api().get(`${ADMIN_API}/api/users?scope=platform&limit=100`));
    expect(list.status).toBe(200);
    expect(list.body.data.map((u: any) => u.id)).toContain(platformUserId);

    const one = await withCookie(api().get(`${ADMIN_API}/api/users/${platformUserId}`));
    expect(one.status).toBe(200);
    expect(one.body.user.isPlatformUser).toBe(true);
  });

  it('tenant users stay fully manageable', async () => {
    const created = await withCookie(api().post(`${ADMIN_API}/api/users`)).send({ email: 'new-tenant-user@test.local' });
    expect(created.status).toBeLessThan(300);

    const updated = await withCookie(api().patch(`${ADMIN_API}/api/users/${tenantUserId}`)).send({ metadata: { note: 'ok' } });
    expect(updated.status).toBe(200);
  });
});

describe('Admin console — allowPlatformUserManagement defaults to on', () => {
  let handle: TestAppHandle;

  beforeAll(async () => {
    handle = await bootTestApp({
      nestAuth: { adminConsole: { enabled: true, secretKey: SECRET }, platformAccess: { enabled: true } } as any,
    });
  });

  afterAll(async () => {
    await handle?.close();
  });

  it('/config reports true when the option is unset (backward compatible)', async () => {
    const res = await request(handle.httpServer).get(`${ADMIN_API}/config`);
    expect(res.body.allowPlatformUserManagement).toBe(true);
  });
});

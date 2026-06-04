/**
 * Real integration tests: role & permission mutations emit lifecycle events so
 * platform code can sync RBAC changes to external systems.
 *
 * NO MOCKS. Real EventEmitter2, real DI, real sqljs DB.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { RoleService, PermissionService, NestAuthEvents } from '../../src';

describe('Role & permission lifecycle events', () => {
  let handle: TestAppHandle;
  let roles: RoleService;
  let permissions: PermissionService;
  let captured: string[];

  beforeEach(async () => {
    handle = await bootTestApp();
    roles = handle.get<RoleService>(RoleService);
    permissions = handle.get<PermissionService>(PermissionService);
    captured = [];
    handle.get<EventEmitter2>(EventEmitter2).onAny((name: any) => captured.push(String(name)));
  });

  afterEach(async () => {
    if (handle) await handle.close();
  });

  it('role create/update/delete each emit their event', async () => {
    const role = await roles.createRole('sync-role', 'web');
    expect(captured).toContain(NestAuthEvents.ROLE_CREATED);

    await roles.updateRole(role.id, { name: 'sync-role-renamed' } as any);
    expect(captured).toContain(NestAuthEvents.ROLE_UPDATED);

    await roles.deleteRole(role.id);
    expect(captured).toContain(NestAuthEvents.ROLE_DELETED);
  });

  it('permission create/update/delete each emit their event', async () => {
    const permission = await permissions.createPermission({ name: 'sync.read', guard: 'web' });
    expect(captured).toContain(NestAuthEvents.PERMISSION_CREATED);

    await permissions.updatePermission(permission.id, { description: 'updated' } as any);
    expect(captured).toContain(NestAuthEvents.PERMISSION_UPDATED);

    await permissions.deletePermission(permission.id);
    expect(captured).toContain(NestAuthEvents.PERMISSION_DELETED);
  });
});

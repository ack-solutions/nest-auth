/**
 * Real integration tests for the user update/delete lifecycle hooks
 * (beforeUpdate / afterUpdate / beforeDelete / afterDelete).
 *
 * Verifies they fire, receive the transactional manager, can mutate/abort, and
 * that a throwing hook rolls the whole mutation back (no half-applied change).
 *
 * NO MOCKS. Real DI, real sqljs DB, real transactions.
 */

import { describe, it, expect, afterEach } from 'vitest';
import type { EntityManager } from 'typeorm';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { UserService } from '../../src';

describe('User update/delete lifecycle hooks', () => {
  let handle: TestAppHandle;

  afterEach(async () => {
    if (handle) await handle.close();
  });

  it('afterUpdate throws → the update rolls back', async () => {
    handle = await bootTestApp({
      nestAuth: {
        user: {
          afterUpdate: async () => {
            throw new Error('boom from afterUpdate');
          },
        },
      },
    });
    const users = handle.get<UserService>(UserService);

    const created = await users.createUser({ email: 'upd-rollback@test.local', isActive: true } as any);

    await expect(users.updateUser(created.id, { isActive: false } as any)).rejects.toThrow();

    // Re-fetch from the DB — the change must NOT have been persisted.
    const fresh = await users.getUserById(created.id);
    expect(fresh!.isActive).toBe(true);
  });

  it('beforeUpdate can enrich the changes; afterUpdate receives the manager', async () => {
    let seenManager: EntityManager | undefined;
    handle = await bootTestApp({
      nestAuth: {
        user: {
          beforeUpdate: () => ({ metadata: { hooked: true } }),
          afterUpdate: (_user, _changes, manager) => {
            seenManager = manager;
          },
        },
      },
    });
    const users = handle.get<UserService>(UserService);

    const created = await users.createUser({ email: 'upd-enrich@test.local', isActive: true } as any);
    await users.updateUser(created.id, { isActive: false } as any);

    const fresh = await users.getUserById(created.id);
    expect(fresh!.isActive).toBe(false);
    expect(fresh!.metadata).toMatchObject({ hooked: true });
    expect(seenManager, 'afterUpdate did not receive a manager').toBeDefined();
    expect(typeof seenManager!.getRepository).toBe('function');
  });

  it('beforeDelete throws → the user is NOT deleted', async () => {
    handle = await bootTestApp({
      nestAuth: {
        user: {
          beforeDelete: async () => {
            throw new Error('boom from beforeDelete');
          },
        },
      },
    });
    const users = handle.get<UserService>(UserService);

    const created = await users.createUser({ email: 'del-abort@test.local' } as any);

    await expect(users.deleteUser(created.id)).rejects.toThrow();

    const stillThere = await users.getUserById(created.id);
    expect(stillThere, 'user was deleted despite a throwing beforeDelete').not.toBeNull();
  });

  it('afterDelete fires with a snapshot and the user is removed', async () => {
    let snapshotEmail: string | undefined;
    handle = await bootTestApp({
      nestAuth: {
        user: {
          afterDelete: (user) => {
            snapshotEmail = user.email;
          },
        },
      },
    });
    const users = handle.get<UserService>(UserService);

    const created = await users.createUser({ email: 'del-happy@test.local' } as any);
    await users.deleteUser(created.id);

    const gone = await users.getUserById(created.id);
    expect(gone).toBeNull();
    expect(snapshotEmail).toBe('del-happy@test.local');
  });
});

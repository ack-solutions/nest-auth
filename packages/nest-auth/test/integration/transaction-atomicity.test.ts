/**
 * Real integration tests for user-creation atomicity.
 *
 * Proves the reliability guarantee: if a lifecycle hook (user.afterCreate or
 * registrationHooks.onSignup) throws, the user is NOT left partially created —
 * the whole transaction rolls back and no row survives.
 *
 * NO MOCKS. Real EventEmitter2, real DI, real sqljs DB, real transactions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { EntityManager } from 'typeorm';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { UserService } from '../../src';

describe('User-creation atomicity', () => {
  let handle: TestAppHandle;

  afterEach(async () => {
    if (handle) await handle.close();
  });

  describe('user.afterCreate throws', () => {
    beforeEach(async () => {
      handle = await bootTestApp({
        nestAuth: {
          user: {
            afterCreate: async () => {
              throw new Error('boom from afterCreate');
            },
          },
        },
      });
    });

    it('signup rolls back — no partial user is left behind', async () => {
      const email = 'rollback-aftercreate@test.local';

      const res = await request(handle.httpServer)
        .post('/auth/signup')
        .send({ email, password: 'StrongPassword!1' });

      // Signup must fail...
      expect(res.status).toBeGreaterThanOrEqual(400);

      // ...and crucially, NO user row may survive the failed hook.
      const userService = handle.get<UserService>(UserService);
      const persisted = await userService.getUserByEmail(email);
      expect(persisted, 'a partial user survived a throwing afterCreate hook').toBeNull();
    });

    it('direct UserService.createUser rolls back (admin/programmatic path)', async () => {
      const email = 'rollback-direct@test.local';
      const userService = handle.get<UserService>(UserService);

      await expect(
        userService.createUser({ email, password: 'StrongPassword!1' } as any),
      ).rejects.toThrow();

      const persisted = await userService.getUserByEmail(email);
      expect(persisted, 'a partial user survived a throwing afterCreate hook').toBeNull();
    });
  });

  describe('registrationHooks.onSignup throws', () => {
    beforeEach(async () => {
      handle = await bootTestApp({
        nestAuth: {
          registrationHooks: {
            onSignup: async () => {
              throw new Error('boom from onSignup');
            },
          },
        },
      });
    });

    it('signup rolls back — no partial user is left behind', async () => {
      const email = 'rollback-onsignup@test.local';

      const res = await request(handle.httpServer)
        .post('/auth/signup')
        .send({ email, password: 'StrongPassword!1' });

      expect(res.status).toBeGreaterThanOrEqual(400);

      const userService = handle.get<UserService>(UserService);
      const persisted = await userService.getUserByEmail(email);
      expect(persisted, 'a partial user survived a throwing onSignup hook').toBeNull();
    });
  });

  describe('happy path + transactional context', () => {
    let afterCreateManager: EntityManager | undefined;
    let onSignupManager: EntityManager | undefined;

    beforeEach(async () => {
      afterCreateManager = undefined;
      onSignupManager = undefined;
      handle = await bootTestApp({
        nestAuth: {
          user: {
            afterCreate: (_user, _input, manager) => {
              afterCreateManager = manager;
            },
          },
          registrationHooks: {
            onSignup: (_user, _input, ctx) => {
              onSignupManager = ctx?.manager;
            },
          },
        },
      });
    });

    it('creates the user and hands hooks the transactional EntityManager', async () => {
      const email = 'atomic-happy@test.local';

      const res = await request(handle.httpServer)
        .post('/auth/signup')
        .send({ email, password: 'StrongPassword!1' });

      expect(res.status).toBeLessThan(300);

      const userService = handle.get<UserService>(UserService);
      const persisted = await userService.getUserByEmail(email);
      expect(persisted).not.toBeNull();
      expect(persisted!.email).toBe(email);

      // Hooks must receive a real transactional manager so their own DB writes
      // can commit/rollback together with the user.
      expect(afterCreateManager, 'afterCreate did not receive a manager').toBeDefined();
      expect(typeof afterCreateManager!.getRepository).toBe('function');
      expect(onSignupManager, 'onSignup did not receive a manager').toBeDefined();
      expect(typeof onSignupManager!.getRepository).toBe('function');
    });
  });
});

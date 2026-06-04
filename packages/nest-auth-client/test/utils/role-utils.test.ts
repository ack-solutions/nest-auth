/**
 * Real tests for utils/role-utils.ts
 *
 * NO MOCKS. Pure functions; no infrastructure needed.
 *
 * Covers: TC-520, TC-521, TC-522, TC-523 from .tasks/test-catalog.md §B.7
 */

import { describe, it, expect } from 'vitest';
import { hasRole, hasPermission, hasAnyAccess, hasAllAccess } from '../../src/utils/role-utils';
import type { ISessionUserData } from '@ackplus/nest-auth-contracts';

/**
 * Build a real session-user shape for tests.
 * No factory library — just plain object literals (typed).
 */
function makeUser(opts: { roles?: string[]; permissions?: string[] } = {}): ISessionUserData {
  return {
    id: 'u-1',
    email: 'test@example.com',
    roles: (opts.roles ?? []).map((name) => ({ name, displayName: name } as any)),
    permissions: opts.permissions ?? [],
  } as ISessionUserData;
}

describe('hasRole — TC-520', () => {
  it('returns true when user has the exact role', () => {
    expect(hasRole(makeUser({ roles: ['admin'] }), 'admin')).toBe(true);
  });

  it('returns false when user lacks the role', () => {
    expect(hasRole(makeUser({ roles: ['user'] }), 'admin')).toBe(false);
  });

  it('returns true when user has ANY of multiple roles (default behavior)', () => {
    expect(hasRole(makeUser({ roles: ['moderator'] }), ['admin', 'moderator'])).toBe(true);
  });

  it('returns true when matchAll=true and user has ALL roles', () => {
    expect(hasRole(makeUser({ roles: ['admin', 'moderator'] }), ['admin', 'moderator'], true)).toBe(true);
  });

  it('returns false when matchAll=true and user has only some roles', () => {
    expect(hasRole(makeUser({ roles: ['admin'] }), ['admin', 'moderator'], true)).toBe(false);
  });

  it('returns true for empty role array (no requirements)', () => {
    expect(hasRole(makeUser({ roles: ['user'] }), [])).toBe(true);
  });

  it('returns false for null user', () => {
    expect(hasRole(null, 'admin')).toBe(false);
  });

  it('returns false for undefined user', () => {
    expect(hasRole(undefined, 'admin')).toBe(false);
  });

  it('returns false when user has no roles', () => {
    expect(hasRole(makeUser({ roles: [] }), 'admin')).toBe(false);
  });

  it('trims role names from user before comparing', () => {
    // The source uses .trim() on role names
    const user = makeUser({ roles: ['  admin  '] });
    expect(hasRole(user, 'admin')).toBe(true);
  });
});

describe('hasPermission — TC-522', () => {
  it('returns true when user has the exact permission', () => {
    expect(hasPermission(makeUser({ permissions: ['users.read'] }), 'users.read')).toBe(true);
  });

  it('returns false when user lacks the permission', () => {
    expect(hasPermission(makeUser({ permissions: ['users.read'] }), 'users.delete')).toBe(false);
  });

  it('returns true when user has ANY of multiple permissions', () => {
    expect(
      hasPermission(makeUser({ permissions: ['users.read'] }), ['users.read', 'users.write']),
    ).toBe(true);
  });

  it('returns true when matchAll=true and user has ALL permissions', () => {
    expect(
      hasPermission(
        makeUser({ permissions: ['users.read', 'users.write'] }),
        ['users.read', 'users.write'],
        true,
      ),
    ).toBe(true);
  });

  it('returns false when matchAll=true and user has only some permissions', () => {
    expect(
      hasPermission(
        makeUser({ permissions: ['users.read'] }),
        ['users.read', 'users.write'],
        true,
      ),
    ).toBe(false);
  });

  it('returns true for empty permission array', () => {
    expect(hasPermission(makeUser({ permissions: ['x'] }), [])).toBe(true);
  });

  it('returns false for null/undefined user', () => {
    expect(hasPermission(null, 'users.read')).toBe(false);
    expect(hasPermission(undefined, 'users.read')).toBe(false);
  });

  it('returns false when user has no permissions', () => {
    expect(hasPermission(makeUser(), 'users.read')).toBe(false);
  });
});

describe('hasAnyAccess — TC-523', () => {
  it('returns true when user matches role requirement', () => {
    expect(
      hasAnyAccess(makeUser({ roles: ['admin'] }), { roles: ['admin'] }),
    ).toBe(true);
  });

  it('returns true when user matches permission requirement (no role match)', () => {
    expect(
      hasAnyAccess(makeUser({ permissions: ['orders.read'] }), {
        roles: ['admin'],
        permissions: ['orders.read'],
      }),
    ).toBe(true);
  });

  it('returns false when user matches neither role nor permission', () => {
    expect(
      hasAnyAccess(makeUser({ roles: ['user'] }), {
        roles: ['admin'],
        permissions: ['orders.read'],
      }),
    ).toBe(false);
  });

  it('returns true when requirements are empty', () => {
    expect(hasAnyAccess(makeUser(), {})).toBe(true);
  });

  it('returns false for null user', () => {
    expect(hasAnyAccess(null, { roles: ['admin'] })).toBe(false);
  });
});

describe('hasAllAccess — TC-523', () => {
  it('returns true only when user has both role AND permission', () => {
    expect(
      hasAllAccess(makeUser({ roles: ['admin'], permissions: ['orders.manage'] }), {
        roles: ['admin'],
        permissions: ['orders.manage'],
      }),
    ).toBe(true);
  });

  it('returns false when user has role but not permission', () => {
    expect(
      hasAllAccess(makeUser({ roles: ['admin'] }), {
        roles: ['admin'],
        permissions: ['orders.manage'],
      }),
    ).toBe(false);
  });

  it('returns false when user has permission but not role', () => {
    expect(
      hasAllAccess(makeUser({ permissions: ['orders.manage'] }), {
        roles: ['admin'],
        permissions: ['orders.manage'],
      }),
    ).toBe(false);
  });

  it('returns true when only one requirement type given and user satisfies it', () => {
    expect(hasAllAccess(makeUser({ roles: ['admin'] }), { roles: ['admin'] })).toBe(true);
    expect(
      hasAllAccess(makeUser({ permissions: ['x'] }), { permissions: ['x'] }),
    ).toBe(true);
  });

  it('returns true for empty requirements', () => {
    expect(hasAllAccess(makeUser(), {})).toBe(true);
  });

  it('returns false for null user with non-empty requirements', () => {
    expect(hasAllAccess(null, { roles: ['admin'] })).toBe(false);
  });
});

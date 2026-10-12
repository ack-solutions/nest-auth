/**
 * Real integration tests for a PER-ACCOUNT session cap.
 *
 * `session.maxSessionsPerUser` used to be a single number applied to every
 * account. It now also accepts a resolver that is asked per sign-in and
 * receives the account id plus the session data about to be stored (which
 * carries roles and permissions), so the cap can vary by role, tenant or plan.
 *
 * Also pinned here: eviction goes through `revokeSession(id, 'evicted')` rather
 * than a raw store delete, so `session.onRevoked` fires for evictions — it was
 * previously silent, which is why apps could not observe them.
 *
 * NO MOCKS — real NestJS app, real session store, real SessionManagerService.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { SessionManagerService } from '../../src';
import { UserService } from '../../src';

type RevokedCall = { userId?: string; reason: string };

/** Boot with a given cap config, returning the manager and a revoke log. */
async function boot(maxSessionsPerUser: unknown) {
  const revoked: RevokedCall[] = [];
  const handle = await bootTestApp({
    nestAuth: {
      session: {
        jwt: { secret: 'max-sessions-test-secret-0123456789' },
        maxSessionsPerUser,
        onRevoked: (session: any, reason: string) => {
          revoked.push({ userId: session?.userId, reason });
        },
      },
    } as any,
  });
  return {
    handle,
    revoked,
    sessions: handle.get<SessionManagerService>(SessionManagerService),
    users: handle.get<UserService>(UserService),
  };
}

/** Create `count` sessions for a user, oldest first. */
async function createSessions(
  sessions: SessionManagerService,
  userId: string,
  count: number,
  data: Record<string, unknown> = {},
) {
  const made = [];
  for (let i = 0; i < count; i++) {
    made.push(await sessions.createSession({ userId, data: data as any }));
    // Keep lastActive strictly ordered so eviction order is deterministic.
    await new Promise((r) => setTimeout(r, 5));
  }
  return made;
}

describe('session.maxSessionsPerUser', () => {
  let open: TestAppHandle | null = null;
  afterEach(async () => {
    await open?.close();
    open = null;
  });

  it('a plain number behaves as before — the cap applies to every account', async () => {
    const { handle, sessions, users } = await boot(3);
    open = handle;

    const a = await users.createUser({ email: 'num-a@test.local', isActive: true });
    const b = await users.createUser({ email: 'num-b@test.local', isActive: true });

    await createSessions(sessions, a.id, 5);
    await createSessions(sessions, b.id, 5);

    // Same cap for both accounts.
    expect(await sessions.getUserSessions(a.id)).toHaveLength(3);
    expect(await sessions.getUserSessions(b.id)).toHaveLength(3);
  });

  it('a function gives two accounts different limits', async () => {
    const { handle, sessions, users } = await boot(
      ({ data }: any) => (data?.roles?.some((r: any) => r.name === 'staff') ? 5 : 2),
    );
    open = handle;

    const staff = await users.createUser({ email: 'fn-staff@test.local', isActive: true });
    const customer = await users.createUser({ email: 'fn-cust@test.local', isActive: true });

    await createSessions(sessions, staff.id, 7, { roles: [{ name: 'staff' }] });
    await createSessions(sessions, customer.id, 7, { roles: [{ name: 'customer' }] });

    expect(await sessions.getUserSessions(staff.id)).toHaveLength(5);
    expect(await sessions.getUserSessions(customer.id)).toHaveLength(2);
  });

  it('the resolver receives the userId and the data about to be stored', async () => {
    const seen: Array<{ userId: string; roleNames: string[] }> = [];
    const { handle, sessions, users } = await boot(({ userId, data }: any) => {
      seen.push({ userId, roleNames: (data?.roles ?? []).map((r: any) => r.name) });
      return 10;
    });
    open = handle;

    const u = await users.createUser({ email: 'ctx@test.local', isActive: true });
    await sessions.createSession({ userId: u.id, data: { roles: [{ name: 'auditor' }] } as any });

    expect(seen).toHaveLength(1);
    expect(seen[0].userId).toBe(u.id);
    expect(seen[0].roleNames).toEqual(['auditor']);
  });

  it('an async function works', async () => {
    const { handle, sessions, users } = await boot(async ({ data }: any) => {
      await new Promise((r) => setTimeout(r, 5));
      return data?.plan === 'pro' ? 4 : 1;
    });
    open = handle;

    const pro = await users.createUser({ email: 'async-pro@test.local', isActive: true });
    const free = await users.createUser({ email: 'async-free@test.local', isActive: true });

    await createSessions(sessions, pro.id, 6, { plan: 'pro' });
    await createSessions(sessions, free.id, 6, { plan: 'free' });

    expect(await sessions.getUserSessions(pro.id)).toHaveLength(4);
    expect(await sessions.getUserSessions(free.id)).toHaveLength(1);
  });

  it.each([
    ['zero', 0],
    ['negative', -5],
    ['fractional', 2.5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a non-number', 'lots' as unknown as number],
    ['null', null as unknown as number],
  ])('a bad result (%s) falls back to the default of 10', async (_label, bad) => {
    const { handle, sessions, users } = await boot(() => bad);
    open = handle;

    const u = await users.createUser({ email: `bad-${String(_label)}@test.local`, isActive: true });
    await createSessions(sessions, u.id, 12);

    expect(await sessions.getUserSessions(u.id)).toHaveLength(10);
  });

  it('an unset option still defaults to 10', async () => {
    const { handle, sessions, users } = await boot(undefined);
    open = handle;

    const u = await users.createUser({ email: 'unset@test.local', isActive: true });
    await createSessions(sessions, u.id, 12);

    expect(await sessions.getUserSessions(u.id)).toHaveLength(10);
  });

  it("an evicted session fires onRevoked with reason 'evicted'", async () => {
    const { handle, sessions, users, revoked } = await boot(2);
    open = handle;

    const u = await users.createUser({ email: 'evict@test.local', isActive: true });
    const made = await createSessions(sessions, u.id, 2);
    expect(revoked).toHaveLength(0); // nothing evicted yet

    // The third sign-in pushes past the cap and must evict the oldest.
    await sessions.createSession({ userId: u.id, data: {} as any });

    expect(revoked).toHaveLength(1);
    expect(revoked[0].reason).toBe('evicted');
    expect(revoked[0].userId).toBe(u.id);

    // It was the least-recently-active one that went.
    const remaining = (await sessions.getUserSessions(u.id)).map((s) => s.id);
    expect(remaining).not.toContain(made[0].id);
    expect(remaining).toHaveLength(2);
  });

  it('eviction does not fire onRevoked for sessions that survive', async () => {
    const { handle, sessions, users, revoked } = await boot(3);
    open = handle;

    const u = await users.createUser({ email: 'evict-one@test.local', isActive: true });
    await createSessions(sessions, u.id, 5);

    // 5 created with a cap of 3 => exactly 2 evictions, all reported as such.
    expect(revoked).toHaveLength(2);
    expect(revoked.every((r) => r.reason === 'evicted')).toBe(true);
    expect(await sessions.getUserSessions(u.id)).toHaveLength(3);
  });

  it('hasReachedMaxSessions honours the resolver', async () => {
    const { handle, sessions, users } = await boot(({ data }: any) =>
      data?.tier === 'high' ? 9 : 1,
    );
    open = handle;

    const u = await users.createUser({ email: 'reached@test.local', isActive: true });
    await sessions.createSession({ userId: u.id, data: { tier: 'high' } as any });

    // One active session: over the cap for the low tier, under it for the high.
    expect(await sessions.hasReachedMaxSessions(u.id, { tier: 'low' } as any)).toBe(true);
    expect(await sessions.hasReachedMaxSessions(u.id, { tier: 'high' } as any)).toBe(false);
  });
});

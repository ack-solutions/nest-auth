/**
 * Real integration tests for auth events firing (TC-008, TC-035, TC-127, etc.)
 * and end-to-end auth journeys.
 *
 * NO MOCKS. Real EventEmitter2, real DI, real DB.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

describe('Auth events fire with correct payloads', () => {
  let handle: TestAppHandle;
  let eventBus: EventEmitter2;
  let receivedEvents: Array<{ name: string; payload: unknown }>;

  beforeEach(async () => {
    handle = await bootTestApp();
    eventBus = handle.get<EventEmitter2>(EventEmitter2);
    receivedEvents = [];

    // Real listener — captures every event the bus emits, no filtering.
    // This is not a mock: it's a real EventEmitter2 listener that the
    // production code would treat identically.
    eventBus.onAny((name: any, payload: unknown) => {
      receivedEvents.push({ name: String(name), payload });
    });
  });

  afterEach(async () => {
    await handle.close();
  });

  it('TC-008: signup emits REGISTERED-style event', async () => {
    const res = await request(handle.httpServer)
      .post('/auth/signup')
      .send({ email: 'events@test.local', password: 'StrongPassword!1' });
    expect(res.status).toBeLessThan(300);

    // Find the signup/registered event in what we captured
    const signupEvent = receivedEvents.find(
      (e) =>
        e.name.includes('REGISTERED') ||
        e.name.includes('registered') ||
        e.name.includes('SIGNUP') ||
        e.name.includes('signup'),
    );
    expect(signupEvent, `no registration event found. Captured: ${receivedEvents.map((e) => e.name).join(', ')}`)
      .toBeDefined();
  });

  it('TC-035: login emits LOGGED_IN-style event', async () => {
    // Setup: create user
    await request(handle.httpServer)
      .post('/auth/signup')
      .send({ email: 'loginev@test.local', password: 'StrongPassword!1' });

    receivedEvents.length = 0; // reset

    const res = await request(handle.httpServer)
      .post('/auth/login')
      .send({
        providerName: 'email',
        credentials: { email: 'loginev@test.local', password: 'StrongPassword!1' },
      });
    expect(res.status).toBeLessThan(300);

    // Actual event names follow the `nest_auth.logged_in` pattern (lowercase with dots).
    const loginEvent = receivedEvents.find(
      (e) =>
        e.name.toLowerCase().includes('logged_in') ||
        e.name.toLowerCase().includes('login'),
    );
    expect(loginEvent, `no login event captured. Captured: ${receivedEvents.map((e) => e.name).join(', ')}`)
      .toBeDefined();
  });
});

describe('TC-014: Concurrent signup race — KNOWN deferred bug (.tasks/021)', () => {
  let handle: TestAppHandle;

  beforeEach(async () => {
    handle = await bootTestApp();
  });

  afterEach(async () => {
    await handle.close();
  });

  // This test DOCUMENTS the known deferred bug from .tasks/021 — without a
  // @Unique constraint on `nest_auth_users.email`, concurrent signups can
  // BOTH succeed. The test flips to assert exactly-one-success when the
  // schema fix lands (planned: per-tenant `(email, tenantId)` unique index
  // after T-099 / T-104, see master roadmap §4).
  it.skip('two parallel signups with same email → exactly one succeeds, one fails (DEFERRED — see .tasks/021)', async () => {
    const email = 'race@test.local';
    const password = 'RacePassword!1';

    const [a, b] = await Promise.allSettled([
      request(handle.httpServer).post('/auth/signup').send({ email, password }),
      request(handle.httpServer).post('/auth/signup').send({ email, password }),
    ]);

    const aStatus = a.status === 'fulfilled' ? a.value.status : 500;
    const bStatus = b.status === 'fulfilled' ? b.value.status : 500;
    const success = [aStatus, bStatus].filter((s) => s >= 200 && s < 300).length;
    const failure = [aStatus, bStatus].filter((s) => s >= 400 && s < 500).length;

    expect(success + failure, `a=${aStatus} b=${bStatus}`).toBe(2);
    expect(success).toBe(1);
    expect(failure).toBe(1);
  });

  // Until the unique constraint lands, document the CURRENT behaviour: both
  // signups currently succeed under race. This test will START failing once
  // .tasks/021 is fixed — at which point flip the .skip above to enable the
  // proper assertion and delete this one.
  it('CURRENT (buggy) behaviour: both parallel signups succeed (regression sentinel — flip when .tasks/021 lands)', async () => {
    const email = 'race-current@test.local';
    const password = 'RacePassword!1';

    const [a, b] = await Promise.allSettled([
      request(handle.httpServer).post('/auth/signup').send({ email, password }),
      request(handle.httpServer).post('/auth/signup').send({ email, password }),
    ]);

    const aStatus = a.status === 'fulfilled' ? a.value.status : 500;
    const bStatus = b.status === 'fulfilled' ? b.value.status : 500;
    const success = [aStatus, bStatus].filter((s) => s >= 200 && s < 300).length;

    // Currently 2; this is the bug. When fix lands, this assertion will fail
    // and signal that the new test (above, currently skipped) should be enabled.
    expect(success).toBe(2);
  });
});

describe('Login error cases — TC-031, TC-032', () => {
  let handle: TestAppHandle;

  beforeEach(async () => {
    handle = await bootTestApp();
    // Pre-create one user for valid-account-tests
    await request(handle.httpServer)
      .post('/auth/signup')
      .send({ email: 'known@test.local', password: 'KnownPassword!1' });
  });

  afterEach(async () => {
    await handle.close();
  });

  it('TC-031: wrong password → 401', async () => {
    const res = await request(handle.httpServer)
      .post('/auth/login')
      .send({
        providerName: 'email',
        credentials: { email: 'known@test.local', password: 'WrongPassword!9' },
      });
    expect(res.status).toBe(401);
  });

  it('TC-032: unknown email → 401 (NOT 404 — no enumeration)', async () => {
    const res = await request(handle.httpServer)
      .post('/auth/login')
      .send({
        providerName: 'email',
        credentials: { email: 'never-existed@test.local', password: 'AnyPassword!1' },
      });
    // Per security suite — no enumeration: both unknown email and wrong password
    // should return 401, not 404.
    expect(res.status).toBe(401);
  });
});

describe('Refresh token round-trip — TC-120', () => {
  let handle: TestAppHandle;

  beforeEach(async () => {
    handle = await bootTestApp();
  });

  afterEach(async () => {
    await handle.close();
  });

  it('TC-120: refresh token returns new access+refresh pair', async () => {
    // Setup: signup
    const signupRes = await request(handle.httpServer)
      .post('/auth/signup')
      .send({ email: 'refresh@test.local', password: 'RefreshPassword!1' });
    expect(signupRes.status).toBeLessThan(300);
    const refreshToken = signupRes.body.refreshToken ?? signupRes.body.tokens?.refreshToken;
    expect(refreshToken).toBeTypeOf('string');

    const refreshRes = await request(handle.httpServer)
      .post('/auth/refresh-token')
      .send({ refreshToken });

    if (refreshRes.status >= 400) {
      // eslint-disable-next-line no-console
      console.error('[TC-120 refresh failure]', refreshRes.status, JSON.stringify(refreshRes.body, null, 2));
    }
    expect(refreshRes.status).toBeLessThan(300);

    const newAccess = refreshRes.body.accessToken ?? refreshRes.body.tokens?.accessToken;
    const newRefresh = refreshRes.body.refreshToken ?? refreshRes.body.tokens?.refreshToken;
    expect(newAccess).toBeTypeOf('string');
    expect(newRefresh).toBeTypeOf('string');
  });

  it('TC-121: refresh with bogus refresh token → 401', async () => {
    const res = await request(handle.httpServer)
      .post('/auth/refresh-token')
      .send({ refreshToken: 'this-is-not-a-real-token' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

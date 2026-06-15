/**
 * Real integration tests for the member-invite flow.
 *
 * inviteUser() must: create-or-link the user, emit USER_INVITED carrying a
 * single-use set-password token (NOT return it), and that token must let the
 * member set a password via the standard reset-password route and then sign in.
 * Re-inviting links the existing user (no duplicate). The HTTP endpoint is
 * auth-guarded. NO MOCKS — the token is read off the emitted event.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { attachEventCapture, type EventCapture } from '../helpers/event-capture';
import { InviteService } from '../../src';

describe('member invite flow', () => {
  let handle: TestAppHandle;
  let events: EventCapture;

  beforeAll(async () => {
    handle = await bootTestApp();
    events = attachEventCapture(handle);
  });
  afterAll(async () => {
    await handle.close();
  });

  const lastInviteToken = (): string | undefined => {
    const ev = events.all().reverse().find((e) => /user_invited/i.test(e.name));
    return (ev?.payload?.payload ?? ev?.payload)?.token;
  };

  it('invites a NEW member: emits a token (not returned), which sets the password and enables login', async () => {
    const invites = handle.get<InviteService>(InviteService);
    events.clear();

    const email = 'invitee@test.local';
    const result = await invites.inviteUser({ email });
    expect(result.isNewUser).toBe(true);
    expect(result.user.email).toBe(email);
    expect((result as any).token).toBeUndefined(); // never returned to the caller

    const token = lastInviteToken();
    expect(token, 'USER_INVITED should carry a set-password token').toBeTruthy();

    // Member sets their password via the standard route, using the invite token.
    const setPw = await request(handle.httpServer)
      .post('/auth/reset-password')
      .send({ token, newPassword: 'InvitedPass!1' });
    expect(setPw.status).toBeLessThan(300);

    // …and can now sign in.
    const login = await request(handle.httpServer)
      .post('/auth/login')
      .send({ providerName: 'email', credentials: { email, password: 'InvitedPass!1' } });
    expect(login.status).toBeLessThan(300);
    expect(login.body.accessToken ?? login.body.tokens?.accessToken).toBeTruthy();
  });

  it('re-inviting an existing member links the same user (no duplicate)', async () => {
    const invites = handle.get<InviteService>(InviteService);
    const email = 'existing-invitee@test.local';
    const first = await invites.inviteUser({ email });
    const second = await invites.inviteUser({ email });
    expect(first.isNewUser).toBe(true);
    expect(second.isNewUser).toBe(false);
    expect(second.user.id).toBe(first.user.id);
  });

  it('the invite token is single-use (rejected after the password is set)', async () => {
    const invites = handle.get<InviteService>(InviteService);
    events.clear();
    await invites.inviteUser({ email: 'single-use@test.local' });
    const token = lastInviteToken();

    const first = await request(handle.httpServer).post('/auth/reset-password').send({ token, newPassword: 'FirstPass!1' });
    expect(first.status).toBeLessThan(300);
    const replay = await request(handle.httpServer).post('/auth/reset-password').send({ token, newPassword: 'SecondPass!2' });
    expect(replay.status).toBeGreaterThanOrEqual(400); // token no longer valid
  });

  it('POST /auth/invite requires authentication (401 without a token)', async () => {
    const res = await request(handle.httpServer).post('/auth/invite').send({ email: 'x@test.local' });
    expect(res.status).toBe(401);
  });
});

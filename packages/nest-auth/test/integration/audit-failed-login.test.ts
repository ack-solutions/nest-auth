/**
 * Real integration test for failed-login audit logging (CMP-3 / TC-CMP-4).
 *
 * HIPAA §164.312(b) requires recording failed access attempts. This verifies a
 * `login_failed` audit event is delivered to the consumer's `audit.onEvent`
 * hook with the right metadata, and that successful logins are NOT logged as failures.
 *
 * NO MOCKS. Real backend, real event bus, real AuditService listener.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

/** Module-level sink the audit.onEvent hook pushes to (reset per test). */
let auditEvents: any[] = [];

describe('Failed-login audit (HIPAA §164.312(b)) — TC-CMP-4', () => {
  let handle: TestAppHandle;

  beforeEach(async () => {
    auditEvents = [];
    handle = await bootTestApp({
      nestAuth: {
        audit: {
          enabled: true,
          onEvent: (e: any) => {
            auditEvents.push(e);
          },
        } as any,
      },
    });
  });

  afterEach(async () => {
    await handle.close();
  });

  it('emits a login_failed audit event on wrong password', async () => {
    // Pre-create a user
    await request(handle.httpServer)
      .post('/auth/signup')
      .send({ email: 'audit-fail@test.local', password: 'CorrectPass!1' });

    auditEvents.length = 0; // ignore the signup audit

    const res = await request(handle.httpServer)
      .post('/auth/login')
      .send({ providerName: 'email', credentials: { email: 'audit-fail@test.local', password: 'WrongPass!9' } });
    expect(res.status).toBe(401);

    const failed = auditEvents.find((e) => e.type === 'login_failed');
    expect(failed, `no login_failed audit event. Captured: ${auditEvents.map((e) => e.type).join(', ')}`)
      .toBeDefined();
    expect(failed.success).toBe(false);
    expect(failed.metadata?.identifier).toBe('audit-fail@test.local');
    expect(failed.metadata?.provider).toBe('email');
    // A stable reason code should be present (INVALID_CREDENTIALS)
    expect(failed.metadata?.reasonCode).toBeTruthy();
  });

  it('emits login_failed for an unknown email (no enumeration, still audited)', async () => {
    const res = await request(handle.httpServer)
      .post('/auth/login')
      .send({ providerName: 'email', credentials: { email: 'ghost@test.local', password: 'AnyPass!1' } });
    expect(res.status).toBe(401);

    const failed = auditEvents.find((e) => e.type === 'login_failed');
    expect(failed).toBeDefined();
    expect(failed.metadata?.identifier).toBe('ghost@test.local');
  });

  it('NEVER leaks the attempted password into the audit event', async () => {
    const password = 'SuperSecret_DoNotLog_!42';
    await request(handle.httpServer)
      .post('/auth/login')
      .send({ providerName: 'email', credentials: { email: 'x@test.local', password } });

    expect(JSON.stringify(auditEvents)).not.toContain(password);
  });

  it('successful login is audited as login (success=true), not login_failed', async () => {
    await request(handle.httpServer)
      .post('/auth/signup')
      .send({ email: 'audit-ok@test.local', password: 'GoodPass!1' });
    auditEvents.length = 0;

    const res = await request(handle.httpServer)
      .post('/auth/login')
      .send({ providerName: 'email', credentials: { email: 'audit-ok@test.local', password: 'GoodPass!1' } });
    expect(res.status).toBeLessThan(300);

    expect(auditEvents.some((e) => e.type === 'login_failed')).toBe(false);
    expect(auditEvents.some((e) => e.type === 'login' && e.success === true)).toBe(true);
  });
});

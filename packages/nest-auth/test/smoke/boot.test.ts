/**
 * Smoke test for bootTestApp helper (T-014).
 *
 * Proves the real-test-only path works end-to-end for the backend:
 *   - Real NestJS app boots
 *   - Real TypeORM (sqljs in-memory) initializes
 *   - Real NestAuthModule wires up
 *   - Real HTTP server is reachable
 *
 * NO MOCKS. No Docker needed (uses in-memory sqljs).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

describe('bootTestApp smoke — T-014', () => {
  let handle: TestAppHandle;

  beforeAll(async () => {
    handle = await bootTestApp();
  });

  afterAll(async () => {
    await handle.close();
  });

  it('boots a real NestJS app with NestAuthModule', () => {
    expect(handle.app).toBeDefined();
    expect(handle.httpServer).toBeDefined();
    expect(handle.moduleRef).toBeDefined();
  });

  it('exposes an HTTP server reachable for supertest', async () => {
    const request = (await import('supertest')).default;
    const res = await request(handle.httpServer).get('/non-existent-route-on-purpose');
    // Framework responds with a 4xx — proves HTTP pipeline is live.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('accepts custom nestAuth config overrides', async () => {
    const customHandle = await bootTestApp({
      nestAuth: {
        appName: 'Custom-App-Name-For-Test',
      },
    });
    expect(customHandle.app).toBeDefined();
    await customHandle.close();
  });
});

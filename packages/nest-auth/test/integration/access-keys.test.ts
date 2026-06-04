/**
 * Real integration tests for the AccessKey (API key) service.
 *
 * NO MOCKS. Resolves the real AccessKeyService from the DI container and
 * exercises it against the real DB.
 *
 * Covers: TC-290 (create returns key), TC-291 (validate), TC-293 (revoke → invalid).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { AccessKeyService } from '../../src/lib/user/services/access-key.service';

describe('AccessKey (API key) service — TC-290..TC-293', () => {
  let handle: TestAppHandle;
  let service: AccessKeyService;
  let userId: string;

  beforeAll(async () => {
    handle = await bootTestApp();
    service = handle.get<AccessKeyService>(AccessKeyService);

    // Create a real user via signup, then grab their id from the DB.
    await request(handle.httpServer)
      .post('/auth/signup')
      .send({ email: 'apikey-owner@test.local', password: 'ApiKeyPass!1' });

    const ds = handle.get<DataSource>(DataSource);
    const rows = await ds.query(
      `SELECT id FROM nest_auth_users WHERE email = 'apikey-owner@test.local'`,
    );
    userId = rows[0].id;
    expect(userId).toBeTypeOf('string');
  });

  afterAll(async () => {
    await handle.close();
  });

  it('TC-290: createAccessKey returns a public + private key', async () => {
    const key = await service.createAccessKey(userId, 'my-first-key');
    expect(key.publicKey).toBeTypeOf('string');
    expect(key.privateKey).toBeTypeOf('string');
    expect(key.publicKey.length).toBeGreaterThan(16);
    expect(key.name).toBe('my-first-key');
    expect(key.isActive).toBe(true);
  });

  it('B-12: the private key is stored HASHED, not in plaintext', async () => {
    const key = await service.createAccessKey(userId, 'hashed-key');
    const plaintext = key.privateKey; // returned once, in plaintext

    // Read what's actually persisted in the DB
    const ds = handle.get<DataSource>(DataSource);
    const rows = await ds.query(
      `SELECT "privateKey", "publicKey" FROM nest_auth_access_keys WHERE "publicKey" = $1`,
      [key.publicKey],
    ).catch(async () =>
      // sqljs uses ? placeholders, not $1
      ds.query(`SELECT privateKey, publicKey FROM nest_auth_access_keys WHERE publicKey = '${key.publicKey}'`),
    );
    const stored = rows[0];

    // Stored secret must NOT equal the plaintext
    expect(stored.privateKey).not.toBe(plaintext);
    // And must NOT equal the publicKey either (domain separation)
    expect(stored.privateKey).not.toBe(stored.publicKey);
    // It's a 64-char sha256 hex
    expect(stored.privateKey).toMatch(/^[a-f0-9]{64}$/);
  });

  it('TC-291: validateAccessKey returns true for correct pair, false for wrong private key', async () => {
    const key = await service.createAccessKey(userId, 'validate-key');

    // The plaintext returned at creation still validates (hashed compare)
    expect(await service.validateAccessKey(key.publicKey, key.privateKey)).toBe(true);
    expect(await service.validateAccessKey(key.publicKey, 'wrong-private-key')).toBe(false);
  });

  it('TC-293: deactivated key is rejected by getAccessKey', async () => {
    const key = await service.createAccessKey(userId, 'revoke-key');
    await service.deactivateAccessKey(key.publicKey);

    // getAccessKey throws for an inactive key
    await expect(service.getAccessKey(key.publicKey)).rejects.toThrow();
  });

  it('getAccessKey for an unknown public key → throws (not found)', async () => {
    await expect(service.getAccessKey('nonexistent-public-key')).rejects.toThrow();
  });

  it('getUserAccessKeys lists all keys for the user', async () => {
    const keys = await service.getUserAccessKeys(userId);
    // We created several above
    expect(Array.isArray(keys)).toBe(true);
    expect(keys.length).toBeGreaterThanOrEqual(3);
    expect(keys.every((k) => k.userId === userId)).toBe(true);
  });
});

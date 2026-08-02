/**
 * A CUSTOM auth provider — a `BaseAuthProvider` subclass passed via
 * `customAuthProviders` with a plain `forRoot` — works end to end. The consumer
 * builds it with `new MyProvider()` (no repo wiring); the provider registry
 * injects the user/identity repositories via `attachRepositories()`.
 *
 * NO MOCKS — real Nest app, real sqljs DB, real HTTP login through the provider.
 */
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { BaseAuthProvider, type AuthProviderUser } from '../../src';
import { NestAuthUser } from '../../src/lib/user/entities/user.entity';

/** A minimal SSO provider that "verifies" a token of the form `sub|email`. */
class MockSsoProvider extends BaseAuthProvider {
  providerName = 'mock-sso';
  skipMfa = true;

  getRequiredFields(): string[] {
    return ['token'];
  }

  async validate(credentials: { token?: string }): Promise<AuthProviderUser | null> {
    const [sub, email] = String(credentials?.token ?? '').split('|');
    if (!sub) return null;
    return {
      userId: sub, // the PROVIDER's user id (external id) — note the field name
      email,
      emailVerified: true, // provider attests the email
      metadata: { via: 'mock-sso' },
    };
  }
}

let handle: TestAppHandle;

beforeAll(async () => {
  // The consumer builds the provider the simple way — no repo wiring needed.
  handle = await bootTestApp({
    nestAuth: { customAuthProviders: [new MockSsoProvider()] } as any,
  });
});

afterAll(async () => {
  await handle?.close();
});

describe('custom auth provider (forRoot + registry-injected repos)', () => {
  it('creates a user + identity and returns a session on first login', async () => {
    const res = await request(handle.httpServer)
      .post('/auth/login')
      .send({ providerName: 'mock-sso', credentials: { token: 'ext-123|ada@example.com' }, createUserIfNotExists: true });

    expect(res.status).toBeLessThan(300);
    expect(JSON.stringify(res.body)).toMatch(/token|user|accessToken/i);

    const userRepo = handle.get<Repository<NestAuthUser>>(getRepositoryToken(NestAuthUser));
    const user = await userRepo.findOne({ where: { email: 'ada@example.com' } });
    expect(user).toBeTruthy();
  });

  it('logs the same external identity back into the SAME user on second login', async () => {
    const first = await request(handle.httpServer)
      .post('/auth/login')
      .send({ providerName: 'mock-sso', credentials: { token: 'ext-777|grace@example.com' }, createUserIfNotExists: true });
    expect(first.status).toBeLessThan(300);

    const second = await request(handle.httpServer)
      .post('/auth/login')
      .send({ providerName: 'mock-sso', credentials: { token: 'ext-777|grace@example.com' }, createUserIfNotExists: true });
    expect(second.status).toBeLessThan(300);

    const userRepo = handle.get<Repository<NestAuthUser>>(getRepositoryToken(NestAuthUser));
    const users = await userRepo.find({ where: { email: 'grace@example.com' } });
    expect(users.length).toBe(1); // no duplicate user
  });

  it('rejects an unknown provider name', async () => {
    const res = await request(handle.httpServer)
      .post('/auth/login')
      .send({ providerName: 'not-registered', credentials: { token: 'x' } });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

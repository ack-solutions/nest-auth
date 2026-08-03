/**
 * Regression for the constructor-capture bug: JwtService (and other services)
 * must read module options LAZILY, not capture them at construction. Under
 * forRootAsync the service is constructed before the async options provider runs
 * setOptions(), so a captured reference is the empty default → signing fails with
 * "Missing session.jwt.secret" (or, pre-2.8.0, silently signs with the insecure
 * default 'secret').
 *
 * NO MOCKS — the real JwtService + the real static AuthConfigService.
 */
import { describe, it, expect } from 'vitest';
import * as jwt from 'jsonwebtoken';
import { JwtService } from '../../src/lib/core/services/jwt.service';
import { AuthConfigService } from '../../src/lib/core/services/auth-config.service';

const SECRET_A = 'a'.repeat(40);
const SECRET_B = 'b'.repeat(40);

function cfg(secret: string) {
  return {
    appName: 'jwt-lazy-test',
    session: { jwt: { secret }, accessTokenValidity: '15m', refreshTokenValidity: '30d' },
    adminConsole: { enabled: false },
  } as any;
}

describe('JwtService reads options lazily (forRootAsync-safe)', () => {
  it('mints a token from options set AFTER the service was constructed', async () => {
    // Construct the service first — as CoreModule does under forRootAsync, before
    // setOptions() has run with the real secret.
    const svc = new JwtService();

    // Now the async options provider "runs".
    AuthConfigService.setOptions(cfg(SECRET_A));

    const token = await svc.generateAccessToken({ sub: 'u1' } as any);
    expect(token).toBeTruthy();
    // Signed with the secret that was live at call time.
    expect(() => jwt.verify(token, SECRET_A)).not.toThrow();
  });

  it('always signs with the CURRENT secret, not one captured at construction', async () => {
    const svc = new JwtService();

    AuthConfigService.setOptions(cfg(SECRET_A));
    const t1 = await svc.generateAccessToken({ sub: 'u1' } as any);
    expect(() => jwt.verify(t1, SECRET_A)).not.toThrow();

    // Rotate the secret — a captured reference would keep signing with A.
    AuthConfigService.setOptions(cfg(SECRET_B));
    const t2 = await svc.generateAccessToken({ sub: 'u1' } as any);
    expect(() => jwt.verify(t2, SECRET_B)).not.toThrow();
    expect(() => jwt.verify(t2, SECRET_A)).toThrow(); // proves it's NOT the old captured secret
  });
});

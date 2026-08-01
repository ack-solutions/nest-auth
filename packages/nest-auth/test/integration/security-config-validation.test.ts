/**
 * Regression tests for the JWT-secret fail-closed validation (audit finding #1).
 *
 * NO MOCKS — exercises the real AuthConfigService.setOptions() validation that
 * NestAuthModule.forRoot() runs at boot. The library ships NO default signing
 * secret, so a missing / known-insecure secret must throw at configuration time
 * rather than silently signing tokens with a guessable key.
 */
import { describe, it, expect } from 'vitest';
import { AuthConfigService } from '../../src/lib/core/services/auth-config.service';

// A syntactically valid, sufficiently long secret used to prove the happy path.
const STRONG = 'x'.repeat(40);

describe('JWT signing secret validation (fail-closed, no insecure default)', () => {
  it('throws when session.jwt.secret is missing', () => {
    expect(() => AuthConfigService.setOptions({} as any)).toThrow(/session\.jwt\.secret is required/i);
  });

  it('throws when session.jwt.secret is the well-known insecure value "secret"', () => {
    expect(() =>
      AuthConfigService.setOptions({ session: { jwt: { secret: 'secret' } } } as any),
    ).toThrow(/insecure/i);
  });

  it('throws for other well-known weak secrets (case-insensitive)', () => {
    for (const weak of ['Change-Me', 'default', 'password', 'jwt-secret']) {
      expect(() =>
        AuthConfigService.setOptions({ session: { jwt: { secret: weak } } } as any),
      ).toThrow(/insecure/i);
    }
  });

  it('only WARNS on a short secret by default (backward compatible)', () => {
    expect(() =>
      AuthConfigService.setOptions({ session: { jwt: { secret: 'short-but-not-blocklisted' } } } as any),
    ).not.toThrow();
  });

  it('throws on a short secret when validateSecretStrength is enabled', () => {
    expect(() =>
      AuthConfigService.setOptions({
        session: { jwt: { secret: 'short', validateSecretStrength: true } },
      } as any),
    ).toThrow(/32 characters/i);
  });

  it('accepts a strong secret', () => {
    expect(() =>
      AuthConfigService.setOptions({
        session: { jwt: { secret: STRONG, validateSecretStrength: true } },
      } as any),
    ).not.toThrow();
  });
});

describe('admin console secret validation (fail-closed)', () => {
  const withAdmin = (adminConsole: Record<string, unknown>) =>
    ({ session: { jwt: { secret: STRONG } }, adminConsole } as any);

  it('throws when the console is enabled with a short (<32 char) secretKey', () => {
    expect(() =>
      AuthConfigService.setOptions(withAdmin({ enabled: true, secretKey: 'short-admin-secret' })),
    ).toThrow(/32 characters/i);
  });

  it('throws on a known-weak/default secretKey', () => {
    for (const weak of ['admin', 'change-me', 'password']) {
      expect(() =>
        AuthConfigService.setOptions(withAdmin({ enabled: true, secretKey: weak })),
      ).toThrow(/secure adminConsole/i);
    }
  });

  it('throws when a dedicated sessionSecret is set but too short', () => {
    expect(() =>
      AuthConfigService.setOptions(
        withAdmin({ enabled: true, secretKey: STRONG, sessionSecret: 'too-short-session' }),
      ),
    ).toThrow(/32 characters/i);
  });

  it('accepts a strong 32+ char secretKey', () => {
    expect(() =>
      AuthConfigService.setOptions(withAdmin({ enabled: true, secretKey: 'a'.repeat(40) })),
    ).not.toThrow();
  });

  it('does NOT validate the secret when the console is disabled', () => {
    expect(() =>
      AuthConfigService.setOptions(withAdmin({ enabled: false, secretKey: 'x' })),
    ).not.toThrow();
  });
});

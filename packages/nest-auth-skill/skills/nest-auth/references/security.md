# Security options

All of these are optional and independent. Add the ones that were asked for.

## Rate limiting, lockout, CAPTCHA, CSRF

```ts
import type { IAuthModuleOptions } from '@ackplus/nest-auth';

export const security: Partial<IAuthModuleOptions> = {
  security: {
    rateLimit: {
      enabled: true,
      keyBy: 'both',                                        // 'ip' | 'identifier' | 'both'
      buckets: { login: { windowMs: 60_000, max: 5 } },     // override any built-in bucket
    },
    lockout: { enabled: true, maxFailedAttempts: 10, window: '15m', lockDuration: '15m' },
    captcha: {
      enabled: true,
      verify: async (token) => token.length > 0,            // call your CAPTCHA provider's verify API
    },
    csrf: { enabled: true, allowedOrigins: ['https://app.example.com'] },
  },
};
```

- **Rate limit** buckets: `login`, `signup`, `forgotPassword`, `verifyOtp`, `passwordlessSend`, `mfaVerify`, `adminLogin`, `adminReset`. Over the limit → 429 with `Retry-After`.
- **Lockout** rejects logins for an account after repeated failures (keyed by identifier + IP).
- **CAPTCHA** is provider-agnostic: you supply `verify`. The client sends the token in the `x-captcha-token` header or a `captchaToken` body field.
- **CSRF** is double-submit protection for cookie-authenticated writes. Not needed in header mode.
- Counters are in memory per instance by default. For several instances pass `rateLimit.store` (an `IRateLimitStore`, for example Redis-backed).
- Behind a proxy, set Express `trust proxy` so the client IP is correct.

Your own routes can reuse these: `@RateLimit('login')`, `@Lockout()`, `@Captcha()`. `@RateLimit` already applies its guard, so do not also list `RateLimitGuard`.

Another way: keep these off and use an existing gateway/WAF or `@nestjs/throttler` if the project already has one.

## Passwords

```ts
import type { IAuthModuleOptions } from '@ackplus/nest-auth';

export const passwords: Partial<IAuthModuleOptions> = {
  password: {
    policy: {
      enabled: true,
      minLength: 10,
      blockCommonPasswords: true,
      blockContainsIdentifier: true,   // password may not contain the email/phone
      checkBreached: false,            // true = check Have I Been Pwned (k-anonymity)
    },
    passwordResetTokenExpiresIn: '1h',
  },
  emailAuth: {
    enabled: true,
    disposable: { enabled: true, mode: 'block' }, // or 'flag' to only emit an event
  },
};
```

Hashing is argon2 by default. To keep hashes from an existing system, supply `password.hash` and `password.verify` instead (for example bcrypt) — useful when migrating users.

## Tokens and sessions

- `session.jwt.secret`: at least 32 random bytes. `validateSecretStrength: true` makes a weak secret a boot error.
- Refresh tokens rotate. `session.refreshTokenReuse.revokeSession` controls whether a replayed token also ends the session.
- `session.maxSessionsPerUser`, `accessTokenValidity`, `refreshTokenValidity`: see `sessions-tokens.md`.

## API keys

For server-to-server callers.

```ts
import { Injectable } from '@nestjs/common';
import { AccessKeyService } from '@ackplus/nest-auth';

@Injectable()
export class IntegrationKeys {
  constructor(private readonly keys: AccessKeyService) {}

  async issue(userId: string, tenantId?: string) {
    const key = await this.keys.createAccessKey(userId, 'CI integration', { tenantId });
    return { publicKey: key.publicKey, privateKey: key.privateKey }; // privateKey is shown once
  }

  revoke(publicKey: string) {
    return this.keys.deactivateAccessKey(publicKey);
  }
}
```

Callers send `Authorization: ApiKey <publicKey>.<privateKey>`. `@Auth()` routes accept it; the request acts as the key's user, with that user's roles and tenant. If the app does not issue keys, switch the feature off with `accessKeys: { enabled: false }`.

## Audit

Two ways, use either or both:

- Listen to events (`LOGGED_IN`, `LOGIN_FAILED`, `PASSWORD_CHANGED`, …) and write your own audit rows. See `advanced.md`.
- `audit: { enabled: true, onEvent: async (event) => { /* store it */ } }` for a single callback.

## Checklist for production

Secrets from env; `cookieOptions.secure: true` over HTTPS; explicit CORS origins; rate limiting on public endpoints that send mail or SMS; admin console disabled or network-restricted; `synchronize: false` with migrations.

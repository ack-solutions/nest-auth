---
id: 012
priority: P2
area: backend
status: fixed
fixed-at: 2026-04-27
package: '@ackplus/nest-auth'
title: GitHubAuthProvider catch block swallows the failure mode
---

> **Fixed.** Replaced the single `catch (err) { throw "Invalid GitHub token" }`
> with mode-specific handling:
> - Network/DNS failure → `OAUTH_PROVIDER_ERROR`
> - GitHub returns 401/403 → `INVALID_CREDENTIALS`
> - GitHub returns 5xx or malformed JSON → `OAUTH_PROVIDER_ERROR`
> - Token valid but no usable email → `OAUTH_EMAIL_NOT_PUBLIC`, with a
>   user-facing message telling them to either make their email public,
>   grant the `user:email` scope, or use another sign-in method.
>
> Also tightened the email-pick logic to prefer a *verified* primary
> email and to surface the verification status as `emailVerified` on the
> provider return — feeds into the #011 verification-flag work.
> Build verified clean.

## Summary

The `try/catch` around the GitHub validation flow returns the same `Invalid GitHub token` exception whether the token itself was bad, the userinfo fetch failed, or the `/user/emails` lookup couldn't find a verified primary email. From the consumer's perspective every failure looks identical.

## Where

`packages/nest-auth/src/lib/core/providers/github-auth.provider.ts:73-75` (approximately)

```ts
} catch (err) {
  console.error(err);
  throw new UnauthorizedException('Invalid GitHub token');
}
```

## Impact

- Users who signed up with a private email on GitHub get `INVALID_CREDENTIALS` with no hint that they need to make their email public (or grant the `user:email` scope).
- Operators debugging a GitHub OAuth outage can't tell if it's their CDN, GitHub's API, or a code bug.

## Fix

Differentiate the failure modes:

```ts
} catch (err) {
  if (err.code === 'NO_VERIFIED_EMAIL') {
    throw new UnauthorizedException({
      code: 'OAUTH_EMAIL_NOT_PUBLIC',
      message: 'Your GitHub email is not publicly visible. Please make it public or use a different sign-in method.',
    });
  }
  this.debugLogger?.error('github', 'validation failed', err);
  throw new UnauthorizedException({
    code: 'OAUTH_PROVIDER_ERROR',
    message: 'Could not validate GitHub credentials',
  });
}
```

## Related

- See [Google provider](packages/nest-auth/src/lib/core/providers/google-auth.provider.ts) for the analogous structure — it also has `console.error` calls that should go through `DebugLoggerService`.

## Verification

- Test with a public-email GitHub user (success).
- Test with a private-email GitHub user (expect `OAUTH_EMAIL_NOT_PUBLIC`).
- Mock GitHub API 5xx and confirm `OAUTH_PROVIDER_ERROR`.

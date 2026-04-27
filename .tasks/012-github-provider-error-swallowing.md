---
id: 012
priority: P2
area: backend
status: open
package: '@ackplus/nest-auth'
title: GitHubAuthProvider catch block swallows the failure mode
---

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

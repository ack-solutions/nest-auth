---
id: 010
priority: P1
area: backend
status: open
package: '@ackplus/nest-auth'
title: Social providers inconsistently set skipMfa
---

## Summary

`GoogleAuthProvider`, `FacebookAuthProvider`, and `AppleAuthProvider` set `skipMfa = true`. `GitHubAuthProvider` does not. The result: a user with MFA enabled who signs in via GitHub gets prompted for an MFA code, but the same user signing in via Google does not.

## Where

- `packages/nest-auth/src/lib/core/providers/google-auth.provider.ts:14` — `skipMfa = true;`
- `packages/nest-auth/src/lib/core/providers/facebook-auth.provider.ts` — `skipMfa = true;`
- `packages/nest-auth/src/lib/core/providers/apple-auth.provider.ts` — `skipMfa = true;`
- `packages/nest-auth/src/lib/core/providers/github-auth.provider.ts` — **missing**

## Impact

Either:
- The behaviour is intentional and the docs need to call it out per provider, OR
- The behaviour is a copy-paste oversight and GitHub should match the others.

Currently the docs ([oauth-google.mdx](apps/docs/content/docs/authentication/oauth-google.mdx)) describe the `skipMfa = true` behaviour as a feature. We should commit to one stance and apply it consistently.

## Recommended fix

Make it a configurable per-provider option rather than a hardcoded class field. Each social provider should default to `skipMfa: true` (the user proved themselves to a third party) but consumers should be able to override:

```ts
google?: { clientId; clientSecret; redirectUri?; skipMfa?: boolean };
```

Whichever direction we go, **all four social providers must behave the same way at the same default.**

## Verification

- Walk through every social provider class and confirm the `skipMfa` declaration is identical (or driven by config).
- Add an integration test that asserts an MFA-enabled user lands at the post-OAuth session **without** an MFA challenge across all four providers.

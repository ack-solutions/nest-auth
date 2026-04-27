---
id: 011
priority: P2
area: backend
status: open
package: '@ackplus/nest-auth'
title: Google access-token flow has email_verified check commented out
---

## Summary

The Google access-token validation path used to reject Google accounts whose `email_verified` was false. That check is now commented out, so unverified Google emails are accepted silently. Either re-enable it, make it configurable, or document why it's disabled.

## Where

`packages/nest-auth/src/lib/core/providers/google-auth.provider.ts:81-84`

```ts
// Optional / depends on scopes; don't *assume* email_verified exists
// if ((tokenInfo as any).email_verified === false) {
//   throw new UnauthorizedException('Google email not verified');
// }
```

## Impact

Low — Google's signup flow already requires email verification for the vast majority of accounts. But for compliance-heavy apps that *must* verify email is owned by Google's standards, the current code provides no signal.

## Fix

Add a config option:

```ts
google?: {
  // …
  requireVerifiedEmail?: boolean;        // default: false (preserve current behaviour)
};
```

When `true`, throw on unverified email **only if `email_verified` is present and `false`** (don't block when the token info doesn't carry the flag — that's the original concern).

## Verification

- Test with a Google ID token where `email_verified === false`: expect `INVALID_CREDENTIALS` when option is on, accept when option is off.
- Document the option in [`oauth-google.mdx`](apps/docs/content/docs/authentication/oauth-google.mdx).

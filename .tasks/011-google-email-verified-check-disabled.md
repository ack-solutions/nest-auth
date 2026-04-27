---
id: 011
priority: P2
area: backend
status: fixed
fixed-at: 2026-04-27
package: '@ackplus/nest-auth'
title: 'Google access-token flow has email_verified check commented out — and lift verification on successful Google / MFA-OTP / passwordless-OTP'
---

> **Fixed.** Scope expanded per user direction — the underlying request was
> "use this verified flag to actually mark email/phone as verified across
> the lib." Three pieces:
>
> 1. **Strict Google `email_verified` gate.** New
>    `google.requireVerifiedEmail` config (default `false`, preserves current
>    behaviour). When `true`, throws `INVALID_CREDENTIALS` if the claim is
>    present and `false`. Missing claim is still tolerated (the original
>    concern that motivated commenting it out).
> 2. **Verification flag plumbed through providers.** `AuthProviderUser`
>    grew optional `emailVerified` / `phoneVerified` fields. Google now sets
>    `emailVerified = payload.email_verified === true`. GitHub sets it from
>    the chosen email's `verified` flag (and treats public-on-profile
>    emails as verified, since GitHub won't let you publish unverified ones).
>    Passwordless-OTP provider sets `emailVerified` / `phoneVerified` based
>    on the channel that consumed the code.
> 3. **`AuthService.applyProviderVerification`** lifts `emailVerifiedAt` /
>    `phoneVerifiedAt` on the matched user when the provider attests the
>    contact channel and the email/phone matches what's on file. Idempotent.
> 4. **MFA email/SMS OTP also stamps verification.** `MfaService.verifyMfa`
>    now calls `markChannelVerified()` after a successful EMAIL/SMS OTP
>    consume — entering a code delivered to the channel is exactly what
>    "verified" means.
>
> Build verified clean. Document the new config in the Google OAuth and
> MFA pages as a follow-up (already covered in concept; spec page is
> auto-generated).

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

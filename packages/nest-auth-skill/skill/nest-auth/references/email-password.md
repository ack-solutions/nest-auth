# Email / phone + password

Email + password works with the base setup; nothing needs enabling.

## Backend options

All optional. Add only what the request needs.

```ts
import type { IAuthModuleOptions } from '@ackplus/nest-auth';

export const passwordAuth: Partial<IAuthModuleOptions> = {
  phoneAuth: { enabled: true },             // phone + password login (off by default)
  registration: {
    enabled: true,                          // false = no public signup
    requireInvitation: false,               // true = signup only for invited users
    autoLoginAfterSignup: true,
    requireVerifiedEmail: false,            // true = no login until the email is verified
  },
  password: {
    policy: { enabled: true, minLength: 10, blockCommonPasswords: true },
  },
};
```

Passwords are hashed with argon2. Custom hashing, breached-password checks and disposable-email blocking are in `security.md`.

## Client calls

`auth` is the `AuthClient`. In React the same functions are on `useNestAuth()`; over plain HTTP see `rest-api.md`.

```ts
import { AuthClient } from '@ackplus/nest-auth-client';

export async function passwordFlows(auth: AuthClient) {
  // Extra keys are sent along; the backend app decides what to do with them (see backend-setup.md).
  await auth.signup({ email: 'a@b.com', password: 'S3cure-pass!', firstName: 'Ada' });

  const res = await auth.login({
    providerName: 'email',
    credentials: { email: 'a@b.com', password: 'S3cure-pass!' },
    rememberMe: true,
  });
  if (res.isRequiresMfa) { /* MFA step, see mfa.md */ }
  if (res.mustChangePassword) { /* route to change-password */ }

  await auth.login({ providerName: 'phone', credentials: { phone: '+15551234567', password: 'S3cure-pass!' } });

  await auth.logout();
}
```

## Email / phone verification

```ts
import { AuthClient } from '@ackplus/nest-auth-client';

export async function verifyEmail(auth: AuthClient, code: string) {
  await auth.sendEmailVerification();   // emits EMAIL_VERIFICATION_REQUESTED
  await auth.verifyEmail({ code });
}
```

Phone: `sendPhoneVerification()` / `verifyPhone({ code })`. Verification is optional unless `registration.requireVerifiedEmail` is set. A link-based flow is also possible: put the code in a URL in your email and call `verifyEmail` from the page it opens.

## Forgot / reset password

Request a code, exchange it for a reset token, set the new password.

```ts
import { AuthClient } from '@ackplus/nest-auth-client';

export async function resetPassword(auth: AuthClient, email: string, code: string, newPassword: string) {
  await auth.forgotPassword({ email });                       // emits PASSWORD_RESET_REQUESTED
  const { resetToken } = await auth.verifyForgotPasswordOtp({ email, code });
  await auth.resetPassword({ token: resetToken as string, newPassword });
}

export async function changePassword(auth: AuthClient, currentPassword: string, newPassword: string) {
  await auth.changePassword({ currentPassword, newPassword });
}
```

`forgotPassword` answers the same way whether or not the account exists, so the UI should not say which emails are registered. Phone reset works the same with `{ phone }`.

## Invitations

`POST /auth/invite` (`{ email? , phone?, tenantId?, metadata? }`, needs the `users.invite` permission) creates or links the user and emits `USER_INVITED` with a single-use `token`. Email a link containing the token; the invited person sets a password with `resetPassword({ token, newPassword })` and then signs in. From your own code, call `InviteService.inviteUser(...)` instead of the endpoint.

## Temporary passwords

When an admin sets a password for someone, flag the user `mustChangePassword`. The flag is on the login response and on `GET /auth/me`, so the UI can route to change-password. `mustChangePassword: { enforce: true }` additionally blocks every other route on the server until it is changed.

## Listeners this feature needs

`EMAIL_VERIFICATION_REQUESTED`, `PHONE_VERIFICATION_REQUESTED`, `PASSWORD_RESET_REQUESTED`, and `USER_INVITED` if invitations are used. See `advanced.md` → Events.

# Email / phone + password

Email + password works with the base setup. Nothing to enable.

## Backend options

```ts
import type { IAuthModuleOptions } from '@ackplus/nest-auth';

export const passwordAuth: Partial<IAuthModuleOptions> = {
  // emailAuth is enabled by default
  phoneAuth: { enabled: true },             // only if phone + password login is wanted
  registration: {
    enabled: true,                          // false = no public signup
    autoLoginAfterSignup: true,
    requireVerifiedEmail: false,            // true = block login until the email is verified
  },
  password: {
    policy: { enabled: true, minLength: 10, blockCommonPasswords: true },
  },
};
```

Add only the keys the request needs. Passwords are hashed with argon2 by the library.

## Client calls

`auth` is the `AuthClient` (or the value of `useNestAuth()` in React — same method names).

```ts
import { AuthClient } from '@ackplus/nest-auth-client';

export async function passwordFlows(auth: AuthClient) {
  // Sign up. Extra keys are passed through to the backend (e.g. metadata).
  await auth.signup({ email: 'a@b.com', password: 'S3cure-pass!', metadata: { firstName: 'Ada' } });

  // Log in. Check the two flags before treating the user as signed in.
  const res = await auth.login({
    providerName: 'email',
    credentials: { email: 'a@b.com', password: 'S3cure-pass!' },
  });
  if (res.isRequiresMfa) { /* go to the MFA step, see mfa.md */ }
  if (res.mustChangePassword) { /* route to change-password */ }

  // Phone + password
  await auth.login({ providerName: 'phone', credentials: { phone: '+15551234567', password: 'S3cure-pass!' } });

  await auth.logout();
}
```

## Email / phone verification

```ts
import { AuthClient } from '@ackplus/nest-auth-client';

export async function verifyEmail(auth: AuthClient, code: string) {
  await auth.sendEmailVerification();   // signed-in user; emits EMAIL_VERIFICATION_REQUESTED
  await auth.verifyEmail({ code });
}
```

Phone: `sendPhoneVerification()` / `verifyPhone({ code })`.

## Forgot / reset password

Three steps: request a code, exchange the code for a reset token, set the new password.

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

`forgotPassword` always answers the same way whether or not the account exists. Do not add UI that reveals which emails are registered.

## Required listeners

Send the code from `EMAIL_VERIFICATION_REQUESTED`, `PHONE_VERIFICATION_REQUESTED` and `PASSWORD_RESET_REQUESTED`. See `advanced.md` → Events.

## Admin-set temporary passwords

`mustChangePassword: { enforce: true }` blocks every route except change-password for a user flagged `mustChangePassword`. The flag is on the login response and on `GET /auth/me`.

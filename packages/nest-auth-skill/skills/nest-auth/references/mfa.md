# MFA (two-factor)

Off by default. Methods: `TOTP` (authenticator app), `EMAIL`, `SMS`, in any combination. TOTP needs no delivery service; EMAIL and SMS need a listener that sends the code. If the user did not name a method, TOTP is the simplest to add; offer the others.

## Backend

```ts
import { NestAuthMFAMethodEnum } from '@ackplus/nest-auth';
import type { IAuthModuleOptions } from '@ackplus/nest-auth';

export const mfa: Partial<IAuthModuleOptions> = {
  mfa: {
    enabled: true,
    methods: [NestAuthMFAMethodEnum.TOTP],       // this list replaces the default
    required: false,                              // true = every user must use MFA
    allowUserToggle: true,                        // users can turn their own MFA on/off
    allowMethodSelection: true,                   // users can pick among the enabled methods
    recoveryCodeCount: 10,                        // backup codes per user
    trustedDeviceSecret: process.env.TRUSTED_DEVICE_SECRET, // needed for "remember this device"
    trustedDeviceDuration: '30d',
  },
};
```

For EMAIL/SMS, send the code from this event:

```ts
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NestAuthEvents } from '@ackplus/nest-auth';
import type { TwoFactorCodeSentEvent } from '@ackplus/nest-auth';

@Injectable()
export class MfaCodeListener {
  @OnEvent(NestAuthEvents.TWO_FACTOR_CODE_SENT)
  async send(event: TwoFactorCodeSentEvent) {
    const { user, method, code } = event.payload;
    // send `code` to user.email or user.phone depending on `method`
  }
}
```

## Login with MFA (client)

`login` succeeds with `isRequiresMfa: true`. The session exists but is not verified; protected routes return 401 `MFA_REQUIRED` until the second step.

```ts
import { AuthClient, NestAuthMFAMethodEnum } from '@ackplus/nest-auth-client';

export async function loginWithMfa(auth: AuthClient, email: string, password: string, readCode: () => Promise<string>) {
  const res = await auth.login({ providerName: 'email', credentials: { email, password } });
  if (!res.isRequiresMfa) return;

  const method = res.defaultMfaMethod ?? res.mfaMethods?.[0] ?? NestAuthMFAMethodEnum.TOTP;
  if (method === NestAuthMFAMethodEnum.EMAIL) await auth.send2fa('email');
  if (method === NestAuthMFAMethodEnum.SMS) await auth.send2fa('phone');
  // TOTP: nothing to send, the user reads the code from their app

  await auth.verify2fa({ otp: await readCode(), method, trustDevice: false });
}
```

Lost device: `auth.verifyRecoveryCode({ code })` completes the login with a backup code and keeps MFA on.

## Enrolment (signed-in user)

```ts
import { AuthClient } from '@ackplus/nest-auth-client';

export async function enrolTotp(auth: AuthClient, readCode: () => Promise<string>) {
  const setup = await auth.setupTotp();            // { secret, qrCode, otpAuthUrl }
  // render setup.qrCode as an <img src>, or show setup.secret for manual entry
  await auth.verifyTotpSetup({ otp: await readCode(), secret: setup.secret });
  await auth.toggleMfa({ enabled: true });
  const { codes } = await auth.generateRecoveryCode(); // show once, user must save them
  return codes;
}
```

Other calls: `getMfaStatus()`, `listTotpDevices()`, `removeTotpDevice(id)`, `toggleMfa({ enabled: false })`, and `resetMfa(recoveryCode)` to clear a lost authenticator using a recovery code.

Trusted devices: pass `trustDevice: true` to `verify2fa` to skip MFA on that device for `trustedDeviceDuration`. Routes that must work before the second step can be marked `@SkipMfa()`.

## Adding MFA to an existing login screen

Keep the existing form. Add one branch after `login()` for `isRequiresMfa`, a code input, and (if TOTP) an enrolment screen in account settings.

## Policy choices

- **Optional per user** (default): `required: false`; each user turns it on.
- **Mandatory:** `required: true`. Every existing user is sent through enrolment at next login, so confirm before enabling it on a live app.
- **Only for some users** (admins, a tenant): keep `required: false` and enforce it in the app, for example a guard on admin routes that checks the user's MFA status.

In React all functions above are on `useNestAuth()`.

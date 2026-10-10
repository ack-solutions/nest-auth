# Passwordless / OTP login

A one-time code is sent by email or SMS; the user logs in with the code. No password.

## Backend

```ts
import type { IAuthModuleOptions } from '@ackplus/nest-auth';

export const passwordless: Partial<IAuthModuleOptions> = {
  passwordless: {
    enabled: true,
    allowSignUp: false, // true = an unknown email/phone creates an account
  },
  otp: { length: 6, format: 'numeric', codeExpiresIn: '10m', maxAttempts: 5 },
};
```

`otp` settings are shared by every code the library issues. Only set them if the request needs non-default values (default: 6 digits, 30 minutes).

## Deliver the code (required)

```ts
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NestAuthEvents } from '@ackplus/nest-auth';
import type { PasswordlessCodeRequestedEvent } from '@ackplus/nest-auth';

@Injectable()
export class PasswordlessListener {
  @OnEvent(NestAuthEvents.PASSWORDLESS_CODE_REQUESTED)
  async send(event: PasswordlessCodeRequestedEvent) {
    const { user, channel, code } = event.payload;
    if (channel === 'email') {
      // await this.mailer.send(user.email, `Your code is ${code}`)
    } else {
      // await this.sms.send(user.phone, `Your code is ${code}`)
    }
  }
}
```

Register the class in a module's `providers`. Use the project's existing mail/SMS service; if there is none, ask which provider to use instead of inventing one.

## Client

```ts
import { AuthClient } from '@ackplus/nest-auth-client';

export async function passwordlessLogin(auth: AuthClient, email: string, code: string) {
  await auth.passwordlessSend({ identifier: email, channel: 'email' }); // or channel: 'sms'
  // ...user types the code...
  return auth.passwordlessLogin({ identifier: email, code, channel: 'email' });
}
```

`passwordlessLogin` returns the normal login response (handle `isRequiresMfa`). In React the same two functions are on `useNestAuth()`.

## Protect the send endpoint

It sends mail/SMS for anonymous callers. Turn on rate limiting when exposing it publicly: `security: { rateLimit: { enabled: true } }` (see `advanced.md`).

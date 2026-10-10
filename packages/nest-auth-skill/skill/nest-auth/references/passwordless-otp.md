# Passwordless / OTP login

A one-time code is sent by email or SMS and the user signs in with it. Can be the only login method or sit next to passwords and social login.

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

`otp` is optional and shared by every code the library issues (default: 6 digits, 30 minutes). `otp.generate` accepts your own generator.

## Deliver the code

The app sends the code with its own mail/SMS service.

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

Register the class in a module's `providers`. Use the project's existing mail/SMS service. If it has none, ask the user which one they want; for local development a listener that logs the code is enough.

## Client

```ts
import { AuthClient } from '@ackplus/nest-auth-client';

export async function passwordlessLogin(auth: AuthClient, email: string, code: string) {
  await auth.passwordlessSend({ identifier: email, channel: 'email' }); // or channel: 'sms'
  // ...the user types the code...
  return auth.passwordlessLogin({ identifier: email, code, channel: 'email' });
}
```

`passwordlessLogin` returns the normal login response. In React both functions are on `useNestAuth()`.

## Variations

- **Magic link:** there is no separate link endpoint. Put the identifier and code in a URL in your email, and have the page it opens call `passwordlessLogin`.
- **SMS:** `channel: 'sms'` with a phone number as `identifier`.
- **Sign-up by code:** `allowSignUp: true`.

## Worth suggesting

The send endpoint emails or texts on behalf of anonymous callers. Rate limiting (`security.md`) is a sensible addition when it is public; offer it rather than adding it silently.

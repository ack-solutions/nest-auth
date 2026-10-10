# Auth flows (React)

All actions come from `useNestAuth()`. The snippets show the calls; build the screens with the project's own form and UI libraries (react-hook-form, Formik, MUI, shadcn, plain inputs).

## Login and signup

```tsx
import { useState } from 'react';
import { useNestAuth } from '@ackplus/nest-auth-react';

export function LoginForm({ onDone, onMfa }: { onDone: () => void; onMfa: () => void }) {
  const { login, isLoading } = useNestAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await login({ providerName: 'email', credentials: { email, password } });
      if (res.isRequiresMfa) return onMfa();            // see mfa.md
      if (res.mustChangePassword) { /* route to change-password */ }
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={submit}>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p role="alert">{error}</p>}
      <button disabled={isLoading}>Sign in</button>
    </form>
  );
}
```

Other calls on `useNestAuth()`:

```tsx
import { useNestAuth } from '@ackplus/nest-auth-react';

export function useAccountActions() {
  const auth = useNestAuth();
  return {
    signup: (email: string, password: string, firstName: string) =>
      auth.signup({ email, password, firstName }),          // extra keys go to the backend's signup hooks
    phoneLogin: (phone: string, password: string) =>
      auth.login({ providerName: 'phone', credentials: { phone, password } }),
    logout: () => auth.logout(),
    logoutEverywhere: () => auth.logoutAll(),
  };
}
```

Errors are thrown with `message`, `code` and `statusCode`. Show `message`; branch on `code` (`INVALID_CREDENTIALS`, `ACCOUNT_INACTIVE`, `RATE_LIMITED`, …).

## Email / phone verification

```tsx
import { useNestAuth } from '@ackplus/nest-auth-react';

export function useEmailVerification() {
  const { sendEmailVerification, verifyEmail } = useNestAuth();
  return {
    send: () => sendEmailVerification(),
    confirm: (code: string) => verifyEmail({ code }),
  };
}
```

Phone: `sendPhoneVerification()` / `verifyPhone({ code })`. For a link-based flow, read the code from the URL and call `verifyEmail`.

## Forgot / reset password

```tsx
import { useNestAuth } from '@ackplus/nest-auth-react';

export function usePasswordReset() {
  const { forgotPassword, verifyForgotPasswordOtp, resetPassword, changePassword } = useNestAuth();
  return {
    request: (email: string) => forgotPassword({ email }),
    // returns the token for the last step
    verify: async (email: string, code: string) => (await verifyForgotPasswordOtp({ email, code })).resetToken,
    finish: (token: string, newPassword: string) => resetPassword({ token, newPassword }),
    change: (currentPassword: string, newPassword: string) => changePassword({ currentPassword, newPassword }),
  };
}
```

The request step answers the same way whether or not the account exists; keep the UI message neutral. An invited user sets their first password with the same `resetPassword({ token, newPassword })`, using the token from the invitation link.

## Passwordless (one-time code)

```tsx
import { useNestAuth } from '@ackplus/nest-auth-react';

export function usePasswordless() {
  const { passwordlessSend, passwordlessLogin } = useNestAuth();
  return {
    send: (email: string) => passwordlessSend({ identifier: email, channel: 'email' }), // or 'sms' with a phone
    login: (email: string, code: string) => passwordlessLogin({ identifier: email, code, channel: 'email' }),
  };
}
```

`login` returns the normal login response (check `isRequiresMfa`). Magic-link style: read `identifier` and `code` from the link's URL and call `passwordlessLogin`.

## Social login

The provider's own SDK or button gives a token; pass it to `login`. Use whichever button library the project has (for Google: `@react-oauth/google`, Google Identity Services directly, or a custom popup).

```tsx
import { useNestAuth } from '@ackplus/nest-auth-react';

export function useSocialLogin() {
  const { login } = useNestAuth();
  // createUserIfNotExists: true lets a first-time user sign up through the provider.
  // Set it to false if social login should only work for existing accounts.
  const social = (providerName: string, credentials: Record<string, unknown>) =>
    login({ providerName, credentials, createUserIfNotExists: true });
  return {
    // Google: the `credential` from the Google button's success callback
    google: (idToken: string) => social('google', { token: idToken, type: 'idToken' }),
    github: (accessToken: string) => social('github', { token: accessToken }),
    facebook: (accessToken: string) => social('facebook', { token: accessToken }),
    // Apple gives the name only on the first authorization; pass it then
    apple: (identityToken: string, firstName?: string, lastName?: string) =>
      social('apple', { token: identityToken, firstName, lastName }),
  };
}
```

- The frontend's OAuth client ID is the same one configured on the backend. Take it from the project's env or from `useClientConfig()`.
- A custom provider on the backend works the same way with its own `providerName`.
- Outside React, `authClient.socialLogin(provider, token, options)` does the same and sends `createUserIfNotExists: true` for you.
- Remind the user to add the app's origin and redirect URI in the provider's console.

## Showing only what the backend supports

```tsx
import { useClientConfig } from '@ackplus/nest-auth-react';

export function useLoginOptions() {
  const { config, isLoading } = useClientConfig();
  return { isLoading, config }; // e.g. hide the Google button when the backend has no Google config
}
```

Optional: hard-coding the options is fine when the user prefers it.

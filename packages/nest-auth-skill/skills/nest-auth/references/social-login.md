# Social login (Google, GitHub, Facebook, Apple, custom)

How it works: the frontend obtains a token from the provider, posts it to Nest Auth, and Nest Auth verifies it and creates the session. Providers are independent; add the ones requested.

First-time users: the login request must carry `createUserIfNotExists: true` for an account to be created. The SDK's `socialLogin` helpers send it; a plain `login` call does not, and then an unknown user is rejected. Leave it off deliberately when social login should only work for existing accounts.

## Backend

A built-in provider is on when its config block is present.

```ts
import type { IAuthModuleOptions } from '@ackplus/nest-auth';

export const social: Partial<IAuthModuleOptions> = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    redirectUri: process.env.GOOGLE_REDIRECT_URI as string,
    // audiences: [iosClientId, androidClientId]  // extra client IDs for native apps
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID as string,
    clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    redirectUri: process.env.GITHUB_REDIRECT_URI as string,
  },
  facebook: {
    appId: process.env.FACEBOOK_APP_ID as string,
    appSecret: process.env.FACEBOOK_APP_SECRET as string,
    redirectUri: process.env.FACEBOOK_REDIRECT_URI as string,
  },
};
```

Apple also takes `teamId`, `keyId`, `privateKey`, `redirectUri`, and `audiences` (Service ID and iOS bundle ID). Google needs the `google-auth-library` package installed on the backend.

## Client

```ts
import { AuthClient } from '@ackplus/nest-auth-client';

// `idToken` comes from the provider's SDK, e.g. the Google Identity Services `credential`.
export async function loginWithGoogle(auth: AuthClient, idToken: string) {
  // creates the account on first sign-in
  return auth.socialLogin('google', idToken, { type: 'idToken' });
}

// The same thing spelled out, e.g. to forbid sign-up through social login:
export async function loginExistingGoogleUser(auth: AuthClient, idToken: string) {
  return auth.login({
    providerName: 'google',
    credentials: { token: idToken, type: 'idToken' },
    createUserIfNotExists: false,
  });
}
```

| Provider | Call |
|---|---|
| Google | `socialLogin('google', idToken, { type: 'idToken' })` (default) or an access token with `{ type: 'accessToken' }` |
| GitHub, Facebook | `socialLogin('github', accessToken)` |
| Apple | `socialLogin('apple', identityToken, { firstName, lastName })` — Apple gives the name only on the first authorization |

`socialLogin` options: `type`, `tenantId`, `nonce`, `name`, `firstName`, `lastName`, `avatarUrl`, `createUserIfNotExists`.

The result is the normal login response (`isRequiresMfa` applies).

### Getting the provider token

Any method that yields a provider token works. Pick what suits the project:

- A provider button library the project already uses (for React + Google: `@react-oauth/google`, or Google Identity Services directly).
- A popup or redirect OAuth flow the project implements; the backend also exposes `GET /auth/callback/:provider`, which relays the provider's redirect query back to the opener window.
- Native SDKs on mobile (see the `nest-auth-react` skill for React Native, `nest-auth-flutter` for Flutter).

The frontend uses the same client ID as the backend. Client IDs are public; client secrets stay on the server.

## Other providers (Microsoft, Okta, your own SSO)

Add a custom provider class and pass it in `customAuthProviders`; the client then logs in with that `providerName`. Example in `advanced.md`.

## Notes

- `auth.getClientConfig()` lists the enabled providers and their public IDs, so the UI can render only the buttons that exist.
- By default an existing account is linked only when the provider reports the email as verified (`social.requireVerifiedEmailForLinking`). Turning that off lets an unverified provider email take over an account; change it only on request.
- Remind the user to register the redirect URI and JavaScript origin in the provider's console.

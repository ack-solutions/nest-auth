# Social login (Google, GitHub, Facebook, Apple)

Flow: the frontend gets a token from the provider with the provider's own SDK, then posts it to Nest Auth, which verifies it and creates the session. A user is created on first login. Enable only the provider that was asked for.

## Backend

A provider is on when its config block is present. Read credentials from env.

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

Apple also needs `teamId`, `keyId`, `privateKey` and `redirectUri`; `audiences` lists the Service ID and the iOS bundle ID.

Install the provider's server library if the project lacks it: Google needs `google-auth-library`.

## Client

```ts
import { AuthClient } from '@ackplus/nest-auth-client';

// `idToken` comes from the provider SDK, e.g. Google Identity Services `credential`.
export async function loginWithGoogle(auth: AuthClient, idToken: string) {
  return auth.login({
    providerName: 'google',
    credentials: { token: idToken, type: 'idToken' },
  });
}
```

- Google: `type: 'idToken'` (default, preferred) or `'accessToken'`.
- GitHub / Facebook: `credentials: { token: accessToken }`.
- Apple: `credentials: { token: identityToken, firstName, lastName }`. Apple returns the name only on the first authorization, so pass it then.
- The response is the normal login response, so handle `isRequiresMfa` the same way.

### React + Google example

Use any Google button library the project already has. With `@react-oauth/google`:

```tsx
import { useNestAuth } from '@ackplus/nest-auth-react';

export function useGoogleLogin() {
  const { login } = useNestAuth();
  // pass this to <GoogleLogin onSuccess={...} />
  return (response: { credential?: string }) =>
    login({ providerName: 'google', credentials: { token: response.credential as string, type: 'idToken' } });
}
```

Wrap the app in `<GoogleOAuthProvider clientId={...}>` with the **same** client ID the backend has. Client IDs are public; client secrets stay on the server.

## Notes

- `GET /auth/client-config` (`auth.getClientConfig()`) lists which providers are enabled and their public IDs. Use it to decide which buttons to render.
- Account linking by email only happens for provider-verified emails by default. Do not weaken `social.requireVerifiedEmailForLinking`.
- React Native: `signInWithGoogle` / `signInWithApple` helpers are in `mobile.md`.
- Tell the user to register the redirect URI and JS origin in the provider console.

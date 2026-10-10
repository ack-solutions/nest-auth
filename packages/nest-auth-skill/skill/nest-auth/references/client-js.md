# JS/TS client (`@ackplus/nest-auth-client`)

Framework-agnostic. Use it directly in plain JS/TS, Vue, Svelte, Angular, Solid or Node. React apps normally use `react.md`, which wraps this client. Not using JavaScript, or prefer raw HTTP? See `rest-api.md`.

```bash
npm i @ackplus/nest-auth-client
```

## Create one client

```ts
import { AuthClient } from '@ackplus/nest-auth-client';

export const auth = new AuthClient({
  baseUrl: 'https://api.example.com',   // include the API's global prefix, e.g. https://api.example.com/api
  accessTokenType: 'cookie',            // 'header' for non-browser clients. Match the backend.
});
```

Create it once and share it. `baseUrl` is the origin plus any Nest global prefix; the client appends `/auth/...`. If the backend changed `routePrefix`, pass matching paths in `endpoints`.

Optional config: `storage` (where header-mode tokens live), `httpAdapter` (`FetchAdapter` by default; `createAxiosAdapter(instance)` to route auth calls through the project's axios), `autoRefresh`, `refreshThreshold`, `logger`, and the callbacks `onTokenRefreshed`, `onLogout`, `onError`.

## Use it

```ts
import { AuthClient } from '@ackplus/nest-auth-client';

export async function boot(auth: AuthClient) {
  await auth.ready();                              // restores a stored session
  if (auth.getIsAuthenticated()) {
    const { valid } = await auth.verifySession();
    if (!valid) await auth.logout();
  }
  auth.onLogout(() => { /* redirect to the login page */ });
}
```

Every auth call is a method on the client. State listeners: `onLogout`, `onTokenRefreshed`, `onTokensSet`, `onTokensRemoved`, `onError`, `subscribeTokenState`. Methods: `signup`, `login`, `logout`, `logoutAll`, `refresh`, `verifySession`, `passwordlessSend`, `passwordlessLogin`, `forgotPassword`, `verifyForgotPasswordOtp`, `resetPassword`, `changePassword`, `sendEmailVerification`, `verifyEmail`, `send2fa`, `verify2fa`, `setupTotp`, `switchTenant`, `getClientConfig`. Request shapes are in the feature reference files.

## Send auth on the app's own API calls

The simplest way is to attach the client to the HTTP layer the project already uses:

```ts
import { AuthClient } from '@ackplus/nest-auth-client';
import type { AxiosLikeInstance } from '@ackplus/nest-auth-client';

export function wireHttp(auth: AuthClient, api: AxiosLikeInstance) {
  // axios: adds the auth header (or credentials in cookie mode), refreshes and retries once on 401
  const detach = auth.attachToAxios(api, {
    onRefreshFailed: () => { /* session is over: go to login */ },
  });

  // fetch: returns a wrapped fetch with the same behaviour
  const authFetch = auth.attachToFetch();

  return { detach, authFetch };
}
```

Other ways:

- `await auth.getAuthHeaders()` returns the headers to add to any request (GraphQL clients, WebSocket handshakes, tRPC, a generated API client).
- `await auth.getAccessToken()` when a library wants the raw token.
- Cookie mode needs nothing beyond sending requests with credentials.

## Errors

Failed calls throw an `AuthError` with `message`, `code` (backend error code such as `INVALID_CREDENTIALS`) and `statusCode`. Branch on `code`, show `message`.

## Feature discovery

`await auth.getClientConfig()` returns what the backend has enabled (email/phone/passwordless, social providers and their public IDs, MFA, tenancy mode, registration). Use it to render only the options that exist instead of hard-coding them.

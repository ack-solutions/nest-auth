# Live OAuth testing (Google & GitHub)

The demo enables a social provider **only when its credentials are set in the
environment** (see `src/app.module.ts`), so it runs fine without them. This guide
shows how to obtain real credentials and run a genuine end-to-end login against
live Google / GitHub.

The login endpoint is:

```
POST http://localhost:3333/api/auth/login
Content-Type: application/json

{ "providerName": "<google|github>", "credentials": { "token": "<token>", "type": "<idToken|accessToken>" } }
```

A successful call returns `{ accessToken, refreshToken, ... }` and (for a new
user) auto-creates the account + links the provider identity.

---

## GitHub (fastest — no browser consent needed)

The GitHub provider validates the supplied `token` by calling the GitHub API as
that user (`GET /user` + `/user/emails`). Any valid GitHub access token works,
including a Personal Access Token — so you can verify the full path with curl.

1. **Create an OAuth app** (enables the provider): GitHub → Settings → Developer
   settings → OAuth Apps → *New OAuth App*.
   - Authorization callback URL: `http://localhost:4200/auth/github/callback`
   - Copy the **Client ID** and generate a **Client secret**.
2. **Get a user token.** Quickest: create a Personal Access Token
   (Settings → Developer settings → Tokens) with scopes **`read:user`** and
   **`user:email`**. (In production you'd exchange the OAuth `code` for a token;
   for a provider smoke-test a PAT exercises the identical code path.)
3. **Run the demo with the credentials:**
   ```bash
   GITHUB_CLIENT_ID=xxx GITHUB_CLIENT_SECRET=yyy pnpm demo:api
   ```
4. **Log in with the token:**
   ```bash
   curl -s -X POST http://localhost:3333/api/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"providerName":"github","credentials":{"token":"ghp_yourTokenHere"}}' | jq
   ```
   Expect `200` with tokens. Re-running links to the **same** user (no duplicate).
   An invalid token returns `401 INVALID_CREDENTIALS`.

---

## Google

The Google provider verifies a Google **ID token** (default) or an **access
token** (`type: "accessToken"`, which calls Google's userinfo endpoint).

1. **Create OAuth credentials:** Google Cloud Console → APIs & Services →
   Credentials → *Create credentials → OAuth client ID* → Web application.
   - Authorized redirect URI: `http://localhost:4200/auth/google/callback`
   - Copy the **Client ID** and **Client secret**.
2. **Get a token** without writing any UI — use the
   [OAuth 2.0 Playground](https://developers.google.com/oauthplayground):
   - Gear icon → "Use your own OAuth credentials" → paste your client ID/secret.
   - Authorize the scopes `userinfo.email` and `userinfo.profile`.
   - Step 2 → "Exchange authorization code for tokens" → copy the **Access token**.
3. **Run the demo with the credentials:**
   ```bash
   GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy pnpm demo:api
   ```
4. **Log in with the access token:**
   ```bash
   curl -s -X POST http://localhost:3333/api/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"providerName":"google","credentials":{"token":"ya29.your-access-token","type":"accessToken"}}' | jq
   ```
   Expect `200` with tokens. If you have a Google **ID token** instead, omit
   `type` (or set `"idToken"`) and pass it as `token`.

---

## What this proves

- Real token verification against the live provider API.
- New-user auto-creation + provider-identity linking (now **transactional** — a
  failure can't leave a half-created social user).
- Re-login maps to the same user (identity dedupe).

## Notes

- `redirectUri` defaults to `http://localhost:4200/auth/<provider>/callback`;
  override with `GOOGLE_REDIRECT_URI` / `GITHUB_REDIRECT_URI` if your frontend
  uses a different route. It must exactly match the value registered with the
  provider.
- Never commit real client secrets. Pass them via the environment only.

---
id: react-native-and-social-login
priority: P1
area: client-sdk
status: design
package: '@ackplus/nest-auth-client, @ackplus/nest-auth-react, @ackplus/nest-auth-react-native (new)'
title: Social login in the SDK + a React Native SDK with native Google/Apple/Facebook auth
---

## Summary

Two related capabilities:

1. **Social login helpers in the SDK** (web + RN): the backend already accepts a provider token (`POST /auth/login { providerName, credentials: { token, type } }`) and the GitHub flow is proven end-to-end by tests. The SDK should add ergonomic helpers so consumers don't hand-assemble the `login` DTO, and so the *token acquisition* (popup / redirect / native screen) is pluggable.

2. **A React Native SDK** (`@ackplus/nest-auth-react-native`): wrap native sign-in (Google account picker, Apple Sign In, Facebook) and the right storage (AsyncStorage / Keychain), reusing the existing framework-agnostic client and React hooks.

**Key architectural advantage:** `@ackplus/nest-auth-client` is already framework-agnostic (pluggable `StorageAdapter` + `HttpAdapter`), and the new `TokenManager` in-memory mirror + `ready()` warm-up (T-167a) already handles **always-async storage** (AsyncStorage). So RN needs *adapters + native token providers + docs*, not a client rewrite. `@ackplus/nest-auth-react`'s hooks are plain React and work in RN.

---

## Part A — Social login in the client SDK

### A.1 The flow (unchanged on the backend)

```
┌─ Client (web or native) ─────────────────────────────────────────┐
│ 1. Acquire a provider token:                                      │
│    - Web:    Google Identity Services popup / redirect → idToken  │
│    - Native: @react-native-google-signin → idToken               │
│    - Apple:  native Sign in with Apple → identityToken           │
│ 2. authClient.socialLogin('google', idToken, { type: 'idToken' }) │
└────────────────────────┬──────────────────────────────────────────┘
                         │ POST /auth/login
                         ▼
        backend validates the token with the provider,
        finds-or-creates the user (handleSocialLogin),
        returns { accessToken, refreshToken } (or mfaRequired)
```

### A.2 New `AuthClient.socialLogin()` helper (down-payment — implemented now)

```ts
/**
 * Convenience wrapper for social/OAuth login. Acquire the provider token
 * yourself (web popup / native SDK), then pass it here.
 */
socialLogin(
  provider: 'google' | 'github' | 'facebook' | 'apple' | string,
  token: string,
  opts?: { type?: 'idToken' | 'accessToken'; createUserIfNotExists?: boolean; tenantId?: string },
): Promise<IAuthResponse>
```

It composes the `login` DTO (`{ providerName, credentials: { token, type }, createUserIfNotExists: true (default), tenantId }`) and reuses the existing MFA-aware `login()` path.

### A.3 Token acquisition is pluggable (not bundled)

The SDK does **not** hard-depend on Google/Apple SDKs (heavy, platform-specific, require native config). Instead it defines a tiny interface that web and native adapters implement:

```ts
export interface SocialAuthProvider {
  readonly id: string;                 // 'google' | 'apple' | ...
  /** Open the provider UI and resolve the token to send to the backend. */
  signIn(): Promise<{ token: string; type?: 'idToken' | 'accessToken' }>;
  signOut?(): Promise<void>;           // native sessions sometimes need this
}
```

Then: `const { token, type } = await googleProvider.signIn(); await authClient.socialLogin('google', token, { type });`

This keeps the core SDK light and lets consumers (or our RN package) wire whichever native lib they want — the "customizable / no developer limitations" principle.

### A.4 React web helper

`@ackplus/nest-auth-react` adds `useSocialLogin()`:

```ts
const { signInWithGoogle, signInWithApple, isPending, error } = useSocialLogin();
// signInWithGoogle() opens Google Identity Services popup, gets idToken,
// calls authClient.socialLogin('google', idToken), updates auth state.
```

Web Google uses **Google Identity Services** (`accounts.google.com/gsi`) loaded on demand; Apple uses **Sign in with Apple JS**. Both are optional — if the consumer already has a token, they call `socialLogin` directly.

---

## Part B — React Native SDK (`@ackplus/nest-auth-react-native`)

### B.1 Package shape

```
packages/nest-auth-react-native/
├── src/
│   ├── index.ts
│   ├── storage/
│   │   ├── async-storage.adapter.ts      # wraps @react-native-async-storage/async-storage
│   │   └── secure-storage.adapter.ts     # wraps react-native-keychain OR expo-secure-store
│   ├── social/
│   │   ├── google.provider.ts            # wraps @react-native-google-signin/google-signin
│   │   ├── apple.provider.ts             # wraps @invertase/react-native-apple-authentication
│   │   ├── facebook.provider.ts          # wraps react-native-fbsdk-next
│   │   └── app-auth.provider.ts          # generic OAuth2/OIDC via react-native-app-auth (any provider, PKCE)
│   ├── provider/
│   │   └── NestAuthNativeProvider.tsx     # thin wrapper around nest-auth-react's AuthProvider w/ RN defaults
│   └── hooks/
│       └── use-native-social-login.ts
└── package.json   # peerDeps: react-native + each native lib OPTIONAL
```

All native libraries are **optional peer dependencies** — installing `@ackplus/nest-auth-react-native` does NOT pull in Google/Apple/Facebook SDKs. A consumer installs only the ones they use, and the matching provider adapter activates.

### B.2 Storage (the RN-specific bit)

- **Default: `AsyncStorageAdapter`** — `@react-native-async-storage/async-storage`. Always async — already handled by `TokenManager`'s mirror + `await client.ready()`.
- **Recommended for production: `SecureStorageAdapter`** — `react-native-keychain` (bare) or `expo-secure-store` (Expo). Tokens live in the OS keychain/keystore, not plain AsyncStorage.
- **Mode: header-only.** Cookie mode is web-only; RN uses `accessTokenType: 'header'`. The SDK forces this default.

### B.3 Native social providers

| Provider | Library (peer dep, optional) | Returns |
|---|---|---|
| Google | `@react-native-google-signin/google-signin` | `idToken` (verify server-side via `google.idToken` flow) |
| Apple | `@invertase/react-native-apple-authentication` (bare) / `expo-apple-authentication` (Expo) | `identityToken` (JWT) — send as `type: 'idToken'` |
| Facebook | `react-native-fbsdk-next` | `accessToken` |
| Any OIDC | `react-native-app-auth` | `idToken`/`accessToken` via PKCE — works for Microsoft, Okta, Auth0, custom |

Each adapter implements the `SocialAuthProvider` interface from Part A.3.

### B.4 Apple specifics (the gotcha)

- Apple returns the user's name/email **only on the very first authorization**. The RN adapter must capture and forward these to the backend on first sign-in, because Apple won't send them again. The backend's Apple provider must accept optional `firstName`/`lastName`/`email` alongside the `identityToken`.
- Apple requires the `identityToken` (a JWT signed by Apple) — backend validates it against Apple's public keys. (Backend Apple provider already exists; verify it accepts the RN token shape — **see task RN-12**.)
- Apple Sign In is **mandatory** if you offer any other social login on iOS (App Store rule). Document this.

### B.5 Backend changes needed (small)

- **Configurable provider URLs** (already started for GitHub in T-8): extend to Google/Facebook so native flows and tests can point at stubs. Google is harder (`google-auth-library` calls Google directly) — add a `google.tokenInfoUrl` / `google.userinfoUrl` override + an injectable verifier so it's stubbable.
- **Apple: accept name/email on first sign-in** (RN-12).
- Confirm `createUserIfNotExists` default for social logins so first native sign-in provisions the user (it does — proven by the GitHub test).

### B.6 Deep-linking (only for the generic `app-auth` provider)

Native Google/Apple/Facebook SDKs handle their own UI and return tokens directly — no deep-link needed. The generic `react-native-app-auth` (for arbitrary OIDC providers) uses the system browser + a redirect URI; the SDK documents the `iOS Info.plist` URL scheme + `AndroidManifest` intent-filter setup.

---

## Test cases (added to `test-catalog.md` §K — React Native + Social)

Native auth UI can't run in headless CI (needs a device/simulator). So we split:

### Testable in CI (real tests, no mocks)
| TC | Test | How |
|---|---|---|
| TC-RN-1 | `socialLogin('github', token)` posts the correct login DTO and returns tokens | Real backend + GitHub stub (extend the proven `oauth-github` pattern) |
| TC-RN-2 | `socialLogin` defaults `createUserIfNotExists: true` | Inspect the request the backend receives |
| TC-RN-3 | `socialLogin` propagates `tenantId` | Real backend, shared-mode |
| TC-RN-4 | `socialLogin` returns `isRequiresMfa` and stores pending tokens (MFA path) | Real backend with MFA enabled |
| TC-RN-5 | `AsyncStorageAdapter` get/set/remove/clear round-trip (always-async) | Real adapter over a real in-memory AsyncStorage impl |
| TC-RN-6 | `TokenManager.ready()` warms the mirror from AsyncStorage before first sync read | Already covered by T-167a tests; add an RN-shaped case |
| TC-RN-7 | `SecureStorageAdapter` interface compliance | Real adapter over a fake-but-real keychain impl |
| TC-RN-8 | `SocialAuthProvider` contract: a fake provider's `signIn()` token flows into `socialLogin` | Real fake provider (real impl of the interface, not a jest mock) |
| TC-RN-9 | Google provider adapter maps native result → `{ token, type: 'idToken' }` | Unit, with a real fake of the native module's return shape |
| TC-RN-10 | Apple provider forwards first-sign-in name/email | Unit, real fake native result |
| TC-RN-11 | Backend Google login works against a stubbed token verifier | Real backend + injectable Google verifier stub (RN-8 backend task) |
| TC-RN-12 | Backend Apple login accepts + persists first-sign-in name/email | Real backend + Apple token stub |

### Device/E2E (manual or Detox, not in unit CI)
| TC | Test |
|---|---|
| TC-RN-E2E-1 | Real Google native sign-in on iOS + Android → logged in |
| TC-RN-E2E-2 | Real Apple Sign In on iOS → logged in, name captured first time |
| TC-RN-E2E-3 | Token persists across app restart (Keychain) |
| TC-RN-E2E-4 | Silent refresh works when access token expires in-app |

---

## Tasks (added to `task-tracker.md` Phase 10)

| ID | Task | Effort |
|---|---|---|
| RN-1 | `AuthClient.socialLogin(provider, token, opts)` helper + export | XS |
| RN-2 | `SocialAuthProvider` interface in contracts + client | XS |
| RN-3 | Real test: `socialLogin` against GitHub stub (TC-RN-1..4) | S |
| RN-4 | `@ackplus/nest-auth-react` `useSocialLogin()` (web: Google Identity Services + Apple JS, lazy-loaded) | M |
| RN-5 | Scaffold `@ackplus/nest-auth-react-native` workspace package (turbo + tsup + RN tsconfig) | S |
| RN-6 | `AsyncStorageAdapter` + `SecureStorageAdapter` + tests (TC-RN-5..7) | S |
| RN-7 | `NestAuthNativeProvider` (RN defaults: header mode, async storage, ready() gate) | S |
| RN-8 | Backend: injectable Google token verifier + `google.*Url` config overrides (stubbable) | M |
| RN-9 | Google native provider adapter (`@react-native-google-signin`) + test (TC-RN-9) | S |
| RN-10 | Apple native provider adapter (`@invertase/react-native-apple-authentication`) + test (TC-RN-10) | S |
| RN-11 | Facebook native provider adapter (`react-native-fbsdk-next`) | S |
| RN-12 | Backend: Apple provider accepts first-sign-in name/email + test (TC-RN-12) | S |
| RN-13 | Generic `react-native-app-auth` provider adapter (any OIDC, PKCE) | M |
| RN-14 | `use-native-social-login` hook | S |
| RN-15 | `apps/example-react-native` (Expo) demo: email + Google + Apple login | M |
| RN-16 | Docs: RN quickstart, native setup (Info.plist/Manifest), Apple App Store rule, secure storage | M |
| RN-17 | Detox E2E harness for TC-RN-E2E-1..4 (optional, device CI) | L |

**Down-payment shipped now:** RN-1 (`socialLogin` helper) + RN-3 (real test against the GitHub stub).

---

## Decisions for you

| # | Decision | Recommendation |
|---|---|---|
| RN-D1 | Expo vs bare RN as the primary target? | **Support both** — adapters are peer-dep based; default docs use Expo (faster onboarding), bare RN documented alongside |
| RN-D2 | Secure storage default? | **Keychain/SecureStore recommended in docs**, AsyncStorage the zero-config default |
| RN-D3 | Ship native provider adapters in `nest-auth-react-native`, or separate packages per provider? | **One package, optional peer deps** — simpler install, tree-shakeable |
| RN-D4 | Web social login in scope now, or RN-only? | **Both** — `useSocialLogin()` for web is small and frequently requested |

---

## Related

- [`client-sdk-token-handling.md`](client-sdk-token-handling.md) — the async-storage-friendly TokenManager that makes RN work
- [`task-tracker.md`](task-tracker.md) — Phase 10 tasks
- [`test-catalog.md`](test-catalog.md) — §K test cases
- Proven pattern: `packages/nest-auth/test/integration/oauth-github.test.ts` (real OAuth via stub) — the template for TC-RN-1..4

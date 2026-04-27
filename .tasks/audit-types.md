# Type/Enum Duplication and Export Audit

**Audit Date:** 2026-04-27  
**Scope:** `@ackplus/nest-auth-contracts`, `@ackplus/nest-auth`, `@ackplus/nest-auth-client`, `@ackplus/nest-auth-react`

---

## A. Duplicated Enums

| Enum Name | Defined In (Files) | Values Match | Recommended Single Home |
|-----------|-------------------|--------------|----------------------|
| `NestAuthMFAMethodEnum` | `packages/nest-auth-contracts/src/auth.ts` (line 21-25) | N/A (only one location) | ✓ Correctly in contracts |
| `NestAuthOTPTypeEnum` | `packages/nest-auth-contracts/src/auth.ts` (line 11-18) | N/A (only one location) | ✓ Correctly in contracts |
| `TenantModeEnum` | `packages/nest-auth-contracts/src/config.ts` (line 65-68) | N/A (only one location) | ✓ Correctly in contracts |
| `SessionStorageType` | `packages/nest-auth/src/lib/core/interfaces/session-options.interface.ts` (line 5-9) | N/A (backend-only) | ⚠ Backend-internal, OK to stay |
| `DebugLogLevel` | `packages/nest-auth/src/lib/core/services/debug-logger.service.ts` (line 4+) | N/A (backend-only) | ✓ Backend-internal only |

**Finding:** No true enum duplication across packages. All shared enums (`NestAuthMFAMethodEnum`, `NestAuthOTPTypeEnum`, `TenantModeEnum`) are correctly centralized in `nest-auth-contracts`. Backend-specific enums (`SessionStorageType`, `DebugLogLevel`) remain in `nest-auth` (appropriate).

---

## B. Duplicated Interfaces/Types — Same Shape

| Type Name | Package Locations | Shape Match | Re-export Chain | Notes |
|-----------|-------------------|-------------|-----------------|-------|
| `IAuthResponse` | `nest-auth-contracts/src/auth.ts` (line 148-153) | N/A (single source) | ✓ Exported from contracts, re-exported in client & backend | Used in `AuthWithTokensResponseDto` and `Verify2faWithTokensResponseDto` |
| `ITokenPair` | `nest-auth-contracts/src/auth.ts` (line 130-133) | N/A (single source) | ✓ Exported from contracts, used in client | Base for token responses |
| `ISessionUserData` | `nest-auth-contracts/src/auth.ts` (line 135-140) | Generic type in contracts | ✓ Imported in client & react | Good re-export pattern |
| `IUserResponse` | `nest-auth-contracts/src/auth.ts` (line 176-188) | N/A (single source) | ✓ Implemented as `UserResponseDto` in backend | Client packages use contracts version |
| `IMessageResponse` | `nest-auth-contracts/src/auth.ts` (line 162-164) | N/A (single source) | ✓ Contracts defines, backend implements as `MessageResponseDto` | Correct pattern |
| `IAuthSession` | `nest-auth-contracts/src/auth.ts` (line 155-160) | N/A (single source) | ✓ Contracts only | **NOTE:** Backend has `INestAuthSession` (entity), contracts has `IAuthSession` (response) — these are different purposes |
| `INestAuthSession` (entity) | `nest-auth-contracts/src/auth.ts` (line 39-51) | N/A (single source) | ✓ Contracts defines entity interface | Also mirrored in backend as `NestAuthSession` entity |
| `ClientSession` | `nest-auth-client/src/types/auth.types.ts` (line 16-24) | ✗ Client-specific shape | N/A | **DUPLICATION RISK:** Mirrors `INestAuthSession` + token fields; no from-contracts import |
| `AuthStatus` | `nest-auth-client/src/types/auth.types.ts` (line 11) | N/A | N/A | Client-specific (not in contracts) — ✓ appropriate |

**Finding:** **No high-risk duplication.** `ClientSession` is client-specific. Entity vs. response types correctly separated.

---

## C. Error Code Duplication

| Error Code Constant | Backend Location | Client Location | Notes |
|-------------------|-----------------|-----------------|-------|
| `AUTH_ERROR_CODES` | `packages/nest-auth/src/lib/auth.constants.ts` (line 26-66) | **Not in client** | ✓ Backend-only, OK |
| `MFA_ERROR_CODES` | `packages/nest-auth/src/lib/auth.constants.ts` (line 69-80) | **Not in client** | ✓ Backend-only, OK |
| `SESSION_ERROR_CODES` | `packages/nest-auth/src/lib/auth.constants.ts` (line 83-88) | **Not in client** | ✓ Backend-only, OK |
| `GUARD_ERROR_CODES` | `packages/nest-auth/src/lib/auth.constants.ts` (line 91-103) | **Not in client** | ✓ Backend-only, OK |
| `API_KEY_ERROR_CODES` | `packages/nest-auth/src/lib/auth.constants.ts` (line 106-112) | **Not in client** | ✓ Backend-only, OK |
| `VALIDATION_ERROR_CODES` | `packages/nest-auth/src/lib/auth.constants.ts` (line 115-122) | **Not in client** | ✓ Backend-only, OK |
| `OTP_ERROR_CODES` | `packages/nest-auth/src/lib/auth.constants.ts` (line 125-130) | **Not in client** | ✓ Backend-only, OK |
| `USER_ERROR_CODES` | `packages/nest-auth/src/lib/auth.constants.ts` (line 133-139) | **Not in client** | ✓ Backend-only, OK |
| `TENANT_ERROR_CODES` | `packages/nest-auth/src/lib/auth.constants.ts` (line 142-154) | **Not in client** | ✓ Backend-only, OK |
| `ERROR_CODES` (consolidated) | `packages/nest-auth/src/lib/auth.constants.ts` (line 157-167) | **Not in client** | ✓ Backend-only aggregation |

**Finding:** ✓ **No duplication.** Error codes are backend-internal and not exposed to clients. This is appropriate — clients should receive error codes in response bodies, not a separate constant.

---

## D. DTO / Payload Duplication — Backend vs Client

| DTO / Payload Type | Backend Definition | Client Definition | Duplication Risk | Notes |
|-------------------|-------------------|------------------|------------------|-------|
| `NestAuthLoginRequestDto` (request) | `packages/nest-auth/src/lib/auth/dto/requests/signup.request.dto.ts` | Uses `ILoginRequest` from contracts | ✓ No duplication | Backend DTO implements contracts interface |
| `NestAuthSignupRequestDto` (request) | `packages/nest-auth/src/lib/auth/dto/requests/signup.request.dto.ts` | Uses `ISignupRequest` from contracts | ✓ No duplication | Correct pattern |
| `AuthTokensResponseDto` (response) | `packages/nest-auth/src/lib/auth/dto/responses/auth.response.dto.ts` (line 15-27) | Uses `ITokensResponse` from contracts | ✓ No duplication | Backend DTO implements contracts interface |
| `UserResponseDto` (response) | `packages/nest-auth/src/lib/auth/dto/responses/auth.response.dto.ts` (line 32-94) | Uses `IUserResponse` from contracts | ✓ No duplication | Backend DTO implements contracts interface |
| `AuthWithTokensResponseDto` (response) | `packages/nest-auth/src/lib/auth/dto/responses/auth.response.dto.ts` (line 102-135) | Uses `IAuthResponse` from contracts | ✓ No duplication | Backend DTO implements contracts interface |
| `JWTTokenPayload` | `packages/nest-auth/src/lib/core/interfaces/token-payload.interface.ts` (line 4-19) | **Not in client** | ✓ Backend-only | Contains sensitive data (should stay backend-only) |
| `SessionPayload` | `packages/nest-auth/src/lib/core/interfaces/token-payload.interface.ts` (line 37-49) | **Not in client** | ✓ Backend-only | Session data (should stay backend-only) |
| `SessionDataPayload` | `packages/nest-auth/src/lib/core/interfaces/token-payload.interface.ts` (line 25-35) | **Not in client** | ✓ Backend-only | Internal session data (should stay backend-only) |
| `ClientSession` | N/A | `packages/nest-auth-client/src/types/auth.types.ts` (line 16-24) | ⚠ Minor mismatch | **ISSUE:** Client-side cache of session info; no from-contracts interface |

**Finding:** ✓ **No high-risk duplication.** DTOs correctly implement contracts interfaces. Sensitive payloads (`JWTTokenPayload`, `SessionPayload`) correctly stay backend-only. `ClientSession` is client-specific and does not conflict.

---

## E. Config Option Overlap

| Config Type | Backend Definition | Client Definition | Notes |
|-------------|-------------------|-----------------|-------|
| `IAuthModuleOptions` | `packages/nest-auth/src/lib/core/interfaces/auth-module-options.interface.ts` (line 288+) | **Not in client** | ✓ Backend-only module configuration |
| `AuthClientConfig` | **Not in backend** | `packages/nest-auth-client/src/types/config.types.ts` (line 137-212) | ✓ Client-only configuration |
| `SessionOptions` | `packages/nest-auth/src/lib/core/interfaces/session-options.interface.ts` (line 26-154) | **Not in client** | ✓ Backend session configuration |
| `AccessTokenType` | N/A | `packages/nest-auth-client/src/types/config.types.ts` (line 132) | ✓ Client-only type union |
| `CookieOptions` | **Multiple definitions** (see F below) | `packages/nest-auth-client/src/storage/cookie.storage.ts` (line 6+) | ⚠ See F. Export Bugs |
| `StorageAdapter` | **Not in backend** | `packages/nest-auth-client/src/types/config.types.ts` (line 12-32) | ✓ Client-only interface |
| `HttpAdapter` | **Not in backend** | `packages/nest-auth-client/src/types/config.types.ts` (line 38-43) | ✓ Client-only interface |

**Finding:** ✓ **No overlap.** Backend and client configs correctly separated. No shared config should cross packages.

---

## F. Export Bugs — Per Package

### **Package: `@ackplus/nest-auth-contracts`**

**Entry Point:** `packages/nest-auth-contracts/src/index.ts`

- ✓ Exports all core types (enums, interfaces, constants)
- ✓ No stale exports detected
- ✓ All exported symbols match their source files
- ✓ Dependency: No dependencies (as expected for contracts)

**Gaps:**
- N/A

---

### **Package: `@ackplus/nest-auth`**

**Entry Point:** `packages/nest-auth/src/index.ts`

**Exports:**
- ✓ `NestAuthModule`, auth module & options
- ✓ `auth.constants` (error codes, providers, events)
- ✓ Auth submodules (auth, session, user, role, permission, tenant)
- ✓ `RequestContext` (via `export * from './lib/request-context'`)
- ✓ Core interfaces (`IAuthModuleOptions`, `IAuthModuleAsyncOptions`, etc.) exported as types
- ✓ `DebugLoggerService`, `DebugLogLevel`
- ✓ Utils (normalization helpers)
- ✓ Re-exports all from `@ackplus/nest-auth-contracts`

**Dependency Check:**
- ✓ Lists `@ackplus/nest-auth-contracts` as a dependency (line 43)

**Potential Issues:**
- ⚠ **`RequestContext` class exported:** Used internally for request context, likely not meant for external consumption. Check if consumers use this.
- ✓ **`auth.constants` fully exported:** Includes error codes, providers, event names. Backend-only usage — acceptable.

---

### **Package: `@ackplus/nest-auth-client`**

**Entry Point:** `packages/nest-auth-client/src/index.ts`

**Exports:**
- ✓ Re-exports `@ackplus/nest-auth-contracts` (lines 9, 60 — **duplicate export**, see below)
- ✓ Client-specific types (`AuthStatus`, `AuthState`, `AuthError`, `DecodedJwt`, `ClientSession`)
- ✓ Config types (`StorageAdapter`, `HttpAdapter`, `AuthClientConfig`, `AccessTokenType`, `EndpointConfig`)
- ✓ Storage adapters (Memory, LocalStorage, SessionStorage, Cookie)
- ✓ HTTP adapters (Fetch, Axios)
- ✓ Token utilities & `TokenManager`
- ✓ `AuthClient`, `EventEmitter`, `RefreshQueue`
- ✓ Role/permission utilities

**Dependency Check:**
- ✓ Lists `@ackplus/nest-auth-contracts` as a dependency (line 50)

**Bugs Found:**
- **BUG: Duplicate `export * from '@ackplus/nest-auth-contracts'`** (lines 9 AND 60)
  - Redundant; keep only one
  - **File:** `packages/nest-auth-client/src/index.ts`
  - **Action:** Remove line 60 (the duplicate at the end)

---

### **Package: `@ackplus/nest-auth-react`**

**Entry Point:** `packages/nest-auth-react/src/index.ts`

**Exports:**
- ✓ Context & Provider
- ✓ Hooks (`useNestAuth`, `useUser`, `useSession`, `useAccessToken`, `useAuthStatus`, `useHasRole`, `useHasPermission`)
- ✓ Guards (Auth, Guest, RequireRole, RequirePermission, HOCs)
- ✓ Next helpers (`createNextAuthHelpers`, `NextAuthProvider`)
- ✓ Cross-tab sync utilities

**Dependency Check:**
- ✓ Lists `@ackplus/nest-auth-client` as a dependency (line 48)
- ⚠ **MISSING:** Does NOT list `@ackplus/nest-auth-contracts` as a direct dependency
  - Uses types indirectly via `nest-auth-client` (which re-exports contracts)
  - Imports `ISessionUserData` and `ClientSession` from `nest-auth-client`
  - **Not strictly a bug** (transitive dependency works), but for clarity and direct type usage, should add contracts as explicit peer/dev dependency

**Potential Issues:**
- ⚠ **No re-export of shared types:** React package does not re-export contracts types
  - Consumers must import from `@ackplus/nest-auth-client` or `@ackplus/nest-auth-contracts` directly
  - Consider: `export * from '@ackplus/nest-auth-client'` at end of index to expose contracts indirectly

---

## G. Misplaced in `nest-auth-contracts`

**Finding:** ✓ **No misplaced types.** All symbols in `nest-auth-contracts` are cross-package contracts:
- Enums: `NestAuthMFAMethodEnum`, `NestAuthOTPTypeEnum`, `TenantModeEnum` — used by backend, client, and react
- Entity interfaces: `INestAuthUser`, `INestAuthSession`, `INestAuthRole`, etc. — contracts for shared domain model
- Request/Response types: `ILoginRequest`, `ISignupRequest`, `IAuthResponse`, etc. — define API shape
- Configuration types: `IEmailAuthConfig`, `IMfaConfig`, `INestAuthTenantOptions` — used in client config response
- Admin types: `IInitializeAdminRequest`, `IAdminUser` — for admin endpoints

All are legitimately cross-package.

---

## H. Missing from `nest-auth-contracts` — Should Be There

| Type Name | Current Location | Current Use | Recommendation |
|-----------|-----------------|-------------|-----------------|
| `CookieOptions` | **3 locations:** `packages/nest-auth/src/lib/core/interfaces/session-options.interface.ts` (line 157), `packages/nest-auth/src/lib/utils/cookie.helper.ts`, `packages/nest-auth-client/src/storage/cookie.storage.ts` | Backend session config + client cookie storage config | ⚠ **Move to contracts** if it needs to be shared config (see details below) |
| `SessionStorageType` | `packages/nest-auth/src/lib/core/interfaces/session-options.interface.ts` (line 5-9) | Backend-only session store selection | ✓ **Stays in backend** — internal implementation detail, not part of client API |
| `RedisSessionOptions` | `packages/nest-auth/src/lib/core/interfaces/session-options.interface.ts` (line 11-24) | Backend session Redis config | ✓ **Stays in backend** — internal implementation detail |
| `ClientSession` | `packages/nest-auth-client/src/types/auth.types.ts` (line 16-24) | Client-side session cache | ✓ **Stays in client** — client-specific; no need in contracts |
| `JWTTokenPayload` | `packages/nest-auth/src/lib/core/interfaces/token-payload.interface.ts` (line 4-19) | Backend JWT payload | ✓ **Stays in backend** — contains sensitive fields, not meant for client |
| `SessionPayload` | `packages/nest-auth/src/lib/core/interfaces/token-payload.interface.ts` (line 37-49) | Backend session data storage | ✓ **Stays in backend** — internal, not part of API contract |
| `SessionDataPayload` | `packages/nest-auth/src/lib/core/interfaces/token-payload.interface.ts` (line 25-35) | Backend session data cache | ✓ **Stays in backend** — internal, not part of API contract |

### **CookieOptions Analysis:**

**Current Status:**
- **Backend:** `packages/nest-auth/src/lib/core/interfaces/session-options.interface.ts` (line 157) — defined as `type CookieOptions = Omit<ExpressCookieOptions, 'maxAge'>`
- **Client:** `packages/nest-auth-client/src/storage/cookie.storage.ts` — defines separate `CookieOptions` interface
- **Backend utility:** `packages/nest-auth/src/lib/utils/cookie.helper.ts` — defines yet another `CookieOptions` interface

**Issue:**
- ⚠ **Three different definitions:** Type-level (Express-based), storage-level (custom interface), and utility-level (custom interface)
- Unclear which is canonical
- Client implementation does not import backend types (cannot due to CommonJS/ESM split)

**Recommendation:**
- Either standardize on a single `CookieOptions` in contracts (if truly shared), or accept these as separate internal types
- If moving to contracts, document the intersection of both versions

---

## I. Cross-Package Version Drift Risks

### **Risk 1: `NestAuthMFAMethodEnum` — Multiple Uses**
- **Defined in:** `packages/nest-auth-contracts/src/auth.ts` (lines 21-25)
- **Used in:**
  - `packages/nest-auth-contracts/src/mfa.ts` — `IMfaConfig`, `IMfaStatusResponse`, `IMfaDevice`, request/response types
  - `packages/nest-auth/src/lib/auth/dto/responses/auth.response.dto.ts` — `AuthWithTokensResponseDto`
  - `packages/nest-auth-client` — implicitly via contracts re-export
  - `packages/nest-auth-react` — implicitly via client re-export
- **Risk Level:** ✓ **LOW** — single source of truth in contracts; re-exports ensure consistency

### **Risk 2: `TenantModeEnum` — Backend & Client Config**
- **Defined in:** `packages/nest-auth-contracts/src/config.ts` (lines 65-68)
- **Used in:**
  - Backend: `packages/nest-auth/src/lib/core/interfaces/auth-module-options.interface.ts` (line 389)
  - Client: Indirectly via config response (passed in client config)
  - Contracts: `INestAuthTenantOptions` (line 62)
- **Risk Level:** ✓ **LOW** — single source of truth in contracts

### **Risk 3: `ISessionUserData` — Generic Type Across Packages**
- **Defined in:** `packages/nest-auth-contracts/src/auth.ts` (lines 135-140) — generic type with constraints
- **Used in:**
  - Backend: Auth responses, session serialization
  - Client: `AuthState`, token decoding
  - React: `AuthContext`, hook return types
- **Risk Level:** ✓ **LOW** — single definition, properly re-exported through chain

### **Risk 4: Error Code Constants — Backend-Only**
- **Defined in:** `packages/nest-auth/src/lib/auth.constants.ts`
- **Used in:**
  - Backend services, controllers, guards
  - **Not used in:** Client or React packages
- **Risk Level:** ✓ **LOW** — no cross-package consumption; backend-internal

### **Risk 5: `ClientSession` vs `INestAuthSession` — Potential Confusion**
- **Client type:** `packages/nest-auth-client/src/types/auth.types.ts` (line 16-24) — client-side cache
- **Contract type:** `packages/nest-auth-contracts/src/auth.ts` (line 39-51) — server entity interface
- **Overlap:** Both represent "session", but different purposes
- **Risk Level:** ⚠ **MEDIUM** — naming similarity but different semantics; no actual conflict since they're in different packages
- **Mitigation:** Ensure documentation is clear on the distinction

### **Risk 6: Multiple `CookieOptions` Definitions**
- **Backend (Express-based):** `packages/nest-auth/src/lib/core/interfaces/session-options.interface.ts` (line 157)
- **Client (custom):** `packages/nest-auth-client/src/storage/cookie.storage.ts`
- **Backend utility (custom):** `packages/nest-auth/src/lib/utils/cookie.helper.ts`
- **Risk Level:** ⚠ **MEDIUM** — three separate definitions; potential for divergence if one is updated
- **Mitigation:** Consolidate into a single canonical definition, ideally in contracts or backend-only

---

## J. Summary Table — Severity & Action Items

| Issue | Severity | File(s) | Quick Fix |
|-------|----------|---------|-----------|
| Duplicate `export * from '@ackplus/nest-auth-contracts'` in client | 🟡 Low | `packages/nest-auth-client/src/index.ts` (line 60) | Remove line 60 |
| Multiple `CookieOptions` definitions | 🟡 Medium | 3 files (see section H) | Standardize to one definition; consider moving to contracts |
| `RequestContext` exported from nest-auth | 🟡 Low | `packages/nest-auth/src/index.ts` | Verify external consumers use it; consider marking internal if not |
| Missing contracts dependency in nest-auth-react | 🟢 Very Low | `packages/nest-auth-react/package.json` | Add as dev/peer dependency for clarity (transitive works fine) |
| `ClientSession` vs `INestAuthSession` naming similarity | 🟢 Very Low | Documentation | Clarify in package READMEs that `ClientSession` is client-cache, `INestAuthSession` is server entity |

---

## K. Recommendations

### **Immediate Actions:**
1. **Remove duplicate export** in `nest-auth-client/src/index.ts` (line 60)
2. **Consolidate `CookieOptions`:** Pick one definition or create a shared version in contracts

### **Medium-Term:**
3. **Add contracts as dev dependency** to `nest-auth-react` for explicit type access
4. **Audit `RequestContext` usage:** If consumers don't use it externally, mark as internal (JSDoc `@internal`)

### **Documentation:**
5. **Add clarification** to package READMEs on the purpose of each package:
   - Contracts = API shape + domain entity types
   - Backend = implementation + internal types (configs, payloads, enums, session management)
   - Client = client-side SDK (storage, HTTP, token management)
   - React = React bindings on top of client

---


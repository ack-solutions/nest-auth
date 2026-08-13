# @ackplus/nest-auth-react-native

## 2.10.2

### Patch Changes

- Updated dependencies
  - @ackplus/nest-auth-client@2.10.2
  - @ackplus/nest-auth-react@2.10.2
  - @ackplus/nest-auth-contracts@2.10.2

## 2.10.1

### Patch Changes

- No SDK changes — lockstep bump for the refresh-token-401 fix (see `@ackplus/nest-auth@2.10.1`).
  - @ackplus/nest-auth-client@2.10.1
  - @ackplus/nest-auth-react@2.10.1
  - @ackplus/nest-auth-contracts@2.10.1

## 2.10.0

### Minor Changes

- Inherits `verifyRecoveryCode` from the shared client + React provider (recovery
  code as a backup authenticator). No RN-specific change.
  - @ackplus/nest-auth-client@2.10.0
  - @ackplus/nest-auth-react@2.10.0
  - @ackplus/nest-auth-contracts@2.10.0

## 2.9.2

### Patch Changes

- No SDK changes — lockstep version bump for the backend MFA config fix (see `@ackplus/nest-auth@2.9.2`).
  - @ackplus/nest-auth-client@2.9.2
  - @ackplus/nest-auth-react@2.9.2
  - @ackplus/nest-auth-contracts@2.9.2

## 2.9.1

### Patch Changes

- No SDK changes — lockstep version bump for the backend MFA hardening patch (see `@ackplus/nest-auth@2.9.1`).
  - @ackplus/nest-auth-client@2.9.1
  - @ackplus/nest-auth-react@2.9.1
  - @ackplus/nest-auth-contracts@2.9.1

## 2.9.0

### Minor Changes

- Inherits the session-preservation fix from `@ackplus/nest-auth-client@2.9.0`
  and `@ackplus/nest-auth-react@2.9.0`: a network failure, timeout, or `5xx`
  during refresh/verify no longer destroys stored tokens or logs the user out —
  only a definitive 401/403 does. Pinned with a regression test through
  `createNestAuthClient`.
  - @ackplus/nest-auth-client@2.9.0
  - @ackplus/nest-auth-react@2.9.0
  - @ackplus/nest-auth-contracts@2.9.0

## 2.8.0

### Minor Changes

- Social login accepts `firstName` / `lastName` / `avatarUrl` (via the shared `AuthClient`). Part of the 2.8.0 security-hardening release.
- Updated dependencies
  - @ackplus/nest-auth-client@2.8.0

## 2.7.6

### Patch Changes

- Updated dependencies
  - @ackplus/nest-auth-client@2.7.6
  - @ackplus/nest-auth-react@2.7.6
  - @ackplus/nest-auth-contracts@2.7.6

## 2.7.5

### Patch Changes

- Updated dependencies
  - @ackplus/nest-auth-client@2.7.5
  - @ackplus/nest-auth-react@2.7.5
  - @ackplus/nest-auth-contracts@2.7.5

## 2.7.4

### Patch Changes

- Updated dependencies
  - @ackplus/nest-auth-client@2.7.4
  - @ackplus/nest-auth-react@2.7.4
  - @ackplus/nest-auth-contracts@2.7.4

## 2.7.3

### Patch Changes

- Updated dependencies
  - @ackplus/nest-auth-client@2.7.3
  - @ackplus/nest-auth-react@2.7.3
  - @ackplus/nest-auth-contracts@2.7.3

## 2.7.2

### Patch Changes

- Updated dependencies
  - @ackplus/nest-auth-client@2.7.2
  - @ackplus/nest-auth-react@2.7.2
  - @ackplus/nest-auth-contracts@2.7.2

## 2.7.1

### Patch Changes

- Updated dependencies
  - @ackplus/nest-auth-client@2.7.1
  - @ackplus/nest-auth-react@2.7.1
  - @ackplus/nest-auth-contracts@2.7.1

## 2.6.1

### Patch Changes

- Updated dependencies
  - @ackplus/nest-auth-client@2.7.0
  - @ackplus/nest-auth-react@2.7.0
  - @ackplus/nest-auth-contracts@2.7.0

## 2.5.3

### Patch Changes

- Updated dependencies
  - @ackplus/nest-auth-client@2.6.0
  - @ackplus/nest-auth-react@2.6.0
  - @ackplus/nest-auth-contracts@2.6.0

## 2.5.2

### Patch Changes

- @ackplus/nest-auth-client@2.5.2
- @ackplus/nest-auth-react@2.5.2
- @ackplus/nest-auth-contracts@2.5.2

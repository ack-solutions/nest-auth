---
id: 014
priority: P3
area: backend
status: fixed
fixed-at: 2026-04-27
package: '@ackplus/nest-auth' (UI subpackage)
title: otp-input skipDefaultStyles prop marked for removal without version pin
---

> **Fixed.** Replaced the `// TODO: Remove in next major release` comment with a proper `@deprecated` JSDoc tag pinned to v3.0.0, including the recommended migration ("use `className` instead"). TypeScript editors will now surface a strikethrough on consumers using the prop. Build verified.

## Summary

The admin console UI has `skipDefaultStyles?: boolean; // TODO: Remove in next major release` on its OTP input component. There's no tracking of which major release that is or how downstream consumers will be warned.

## Where

`packages/nest-auth/ui/src/components/form/fields/otp-input.tsx:53` (approximately)

## Fix

Pick one:

1. **Remove now** if no consumer depends on it (we control the embedded UI; nobody imports this component externally).
2. **Mark formally** with `@deprecated` JSDoc + a console warning in dev mode + a target version in CHANGELOG:

```ts
/**
 * @deprecated Will be removed in v3.0.0. Use the `unstyled` prop instead.
 */
skipDefaultStyles?: boolean;
```

## Verification

- Decide which path; if removal, audit `packages/nest-auth/ui/src/` for any uses (likely none) and delete.

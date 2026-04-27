---
id: 024
priority: P3
area: backend
mode: shared
status: fixed
fixed-at: 2026-04-27
package: '@ackplus/nest-auth'
title: MFA secrets and trusted devices are user-global, not tenant-scoped — undocumented
---

> **Fixed (Option A — document the design choice).** Added an "MFA scope across tenants" section to [`apps/docs/content/docs/concepts/mfa.mdx`](../apps/docs/content/docs/concepts/mfa.mdx) covering the user-global behaviour, the security trade-off, and how to enforce per-tenant MFA via `loginHooks.onLogin` or `guards.beforeAuth` for high-security cases. No code change. Option B (per-tenant MFA secrets) deferred unless a customer raises it.

## Summary

`NestAuthMFASecret` and `NestAuthTrustedDevice` reference `userId` but no `tenantId`. In SHARED mode this means: a user enrolls TOTP once (or a trusted device once), and that enrolment applies across all their tenants. Same MFA secret for tenant Acme and tenant Stark.

This is a reasonable default for SHARED mode (one user → one MFA setup) but the docs don't call it out, and the security implication isn't obvious to consumers:

> If an attacker compromises Alice's TOTP device, they can sign into every tenant Alice belongs to with the same code — including tenants whose admins enabled "MFA required" specifically for higher-security data.

## Where

- `packages/nest-auth/src/lib/auth/entities/mfa-secret.entity.ts:1-33` — no `tenantId` column.
- Same for `nest_auth_trusted_devices`.

## Fix

Decide and document:

### Option A — Confirm and document (recommended for SHARED mode)

Update [`/docs/concepts/mfa`](apps/docs/content/docs/concepts/mfa.mdx) and [`/docs/concepts/multi-tenancy`](apps/docs/content/docs/concepts/multi-tenancy.mdx) with a security-trade-off note: "MFA enrolment is user-global. A compromised authenticator gives access to every tenant the user belongs to. To require per-tenant re-enrolment, see X." Then provide hooks to enforce per-tenant MFA via `loginHooks.onLogin` (e.g. require fresh TOTP on tenant switch).

### Option B — Add per-tenant MFA option

Adds a `tenantId` column to `nest_auth_mfa_secrets`. Per-tenant enrolment + per-tenant trusted-device tokens. Bigger lift; only worth it if customers actually ask.

## Recommended path

**Option A.** Document the design choice plainly, add a "force MFA on tenant switch" recipe for high-security cases, and revisit Option B if a customer raises a compliance issue.

## Verification

- Docs page change is enough for Option A.
- For Option B, add a test that an MFA secret created in tenant A doesn't satisfy MFA challenge in tenant B.

## Related

- #017 — switchTenant currently doesn't trigger MFA re-prompt; if Option A is chosen, document this.

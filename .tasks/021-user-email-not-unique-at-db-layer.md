---
id: 021
priority: P1
area: backend
mode: shared
status: deferred
package: '@ackplus/nest-auth'
title: nest_auth_users.email is only @Index, not @Unique — concurrent-signup race
---

> **Deferred.** The simple fix (`@Unique(['email'])` on `NestAuthUser`)
> works for SHARED + DISABLED modes but **breaks ISOLATED mode**, where
> the same email is allowed to exist once per tenant. Per-tenant
> uniqueness can't be expressed at the DB layer right now because
> `tenantId` is not a column on `nest_auth_users` — it lives on
> `nest_auth_user_access`. Doing this properly needs one of:
> 1. Hoist `tenantId` onto `nest_auth_users` (schema change, multi-mode
>    migration, touches identity entities too).
> 2. A partial unique index with a per-mode CASE that varies at deploy time.
> 3. A deferred constraint trigger.
>
> All three are bigger than a P1 paper-cut deserves, and the API-level
> existence check in `UserService.create` already covers normal traffic.
> The race window is narrow and only matters under heavy concurrent
> signup load. Re-open as part of any larger schema rework, e.g. when
> #022 (`tenantId` as a session column) is tackled.

## Summary

In SHARED mode, `nest_auth_users.email` is supposed to be globally unique (one user per email regardless of how many tenants they belong to). The application logic enforces this in `UserService.create` by checking for an existing row before inserting — but the entity declares `@Index()` only, not `@Unique()`. Two concurrent signup requests for the same email can both pass the existence check and both INSERT, ending with two `NestAuthUser` rows sharing an email.

Same applies to `phone`.

In ISOLATED mode, the same email is **expected** to exist multiple times (once per tenant), so a global unique constraint would actively break the feature.

## Where

`packages/nest-auth/src/lib/user/entities/user.entity.ts:32-37`

```ts
@Column({ nullable: true })
@Index()           // ← should also be @Unique
email?: string;

@Column({ nullable: true })
@Index()           // ← should also be @Unique
phone?: string;
```

## Impact

- Race-condition on concurrent signups → duplicate users.
- Once the duplicate exists, the next login picks one (probably the first `findOne` result) and the user "loses" the other account.
- Identity-linking (`nest_auth_identities`) further compounds — a user signs up with email/password, then a partial OAuth signup with the same email, and you can end up with two user rows + scattered identities.

## Fix

Add unique constraints. Because both columns are nullable (`{ nullable: true }`) and TypeORM treats null differently per dialect, use a partial unique index where the dialect supports it:

### Postgres (preferred — partial unique on non-null)

```ts
@Index('uq_nest_auth_users_email', { unique: true, where: 'email IS NOT NULL' })
@Index('uq_nest_auth_users_phone', { unique: true, where: 'phone IS NOT NULL' })
@Entity({ name: 'nest_auth_users' })
export class NestAuthUser { … }
```

### MySQL / SQLite fallback

Standard `@Unique(['email'])` — null values are duplicate-allowed in MySQL/SQLite, which is the desired behaviour anyway (a phone-only user has `email = NULL`).

```ts
@Index(['email'], { unique: true })   // only-non-null treatment varies by DB
```

Test on both Postgres and MySQL.

### Migration

A migration is required for existing deployments — there may be duplicates from the race window. The migration should:

1. Identify duplicate emails: `SELECT email, COUNT(*) FROM nest_auth_users WHERE email IS NOT NULL GROUP BY email HAVING COUNT(*) > 1;`
2. Manually decide a merge policy (or surface the conflict to operators).
3. Apply the constraint.

## Verification

- Two concurrent `POST /auth/signup` calls with the same email → exactly one user row.
- Use a deliberate race (start two transactions, hold one's check phase, complete the other's insert, then complete the first's insert) — the second insert must throw a unique-constraint violation, which the service catches and returns `EMAIL_ALREADY_EXISTS`.
- DB-level: `\d+ nest_auth_users` shows the unique constraint.

## Related

- See [User Model docs](apps/docs/content/docs/concepts/user-model.mdx) — they describe email as globally unique without mentioning the missing constraint.

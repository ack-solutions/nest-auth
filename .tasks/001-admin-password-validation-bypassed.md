---
id: 001
priority: P0
area: backend
status: fixed
fixed-at: 2026-04-27
package: '@ackplus/nest-auth'
title: Admin login bypasses password validation
---

> **Fixed.** Uncommented the `if (!valid) throw new UnauthorizedException(...)`
> branch in `AdminAuthService.validateCredentials`. Wrong-password admin
> logins now correctly return 401. Build verified clean. Pairs with #002
> (plaintext password log, fixed earlier).

## Summary

`AdminAuthService.validateCredentials` computes whether the password matches the stored hash, but the rejection branch is commented out — so **any password authenticates as admin** as long as the email exists.

## Where

`packages/nest-auth/src/lib/admin-console/services/admin-auth.service.ts:18-31`

```ts
async validateCredentials(email: string, password: string): Promise<NestAuthAdminUser> {
  const admin = await this.adminUsers.findByEmail(email);
  if (!admin) {
    throw new UnauthorizedException('Invalid credentials');
  }
  console.log('admin', password);              // ← see also #002
  const valid = await admin.validatePassword(password);
  // if (!valid) {
  //   throw new UnauthorizedException('Invalid credentials');
  // }
  admin.lastLoginAt = new Date();
  await admin.save();
  return admin;
}
```

## Impact

Critical security hole. Anyone who knows an admin email can sign into the embedded admin console, gaining full access to every user, role, permission, tenant, and API key.

## Fix

Uncomment the rejection branch:

```ts
const valid = await admin.validatePassword(password);
if (!valid) {
  throw new UnauthorizedException('Invalid credentials');
}
```

## Verification

- Add an integration test under `packages/nest-auth/src/tests/` that posts a wrong password to the admin login endpoint and asserts a 401.
- Add a passing-path test with the correct password.
- Run `pnpm -C packages/nest-auth build` to confirm no breakage.

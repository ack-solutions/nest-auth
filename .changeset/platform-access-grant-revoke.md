---
'@ackplus/nest-auth': minor
---

Grant, revoke, and create platform (super-admin) users from the admin console.

2.11.0 shipped platform user management as roles-only — an existing platform user's roles could be changed, but there was no way to make someone a platform user, so a non-platform user's detail page had nothing actionable on it. Both paths are now supported.

**Admin API**

- `PATCH /api/users/:id` accepts `isPlatformUser: true | false` to grant or revoke the `NestAuthPlatformAccess` marker. Granting is idempotent and is applied **before** `platformRoleIds`, so a single request can grant access and set platform roles together. Revoking removes the marker and its platform roles; tenant memberships and tenant roles are untouched.
- `POST /api/users` accepts `isPlatformUser: true` to provision a tenant-less platform user directly (`tenantId` is ignored, and the ISOLATED-mode tenant requirement does not apply).
- Both require `platformAccess.enabled` in the module config; otherwise they are refused with `400 PLATFORM_ACCESS_DISABLED`. Assigning `platformRoleIds` to a user with no platform access is still `400 NOT_PLATFORM_USER` — grant it first, or in the same request.

**Admin console UI**

- User detail: "Grant access" on a non-platform user; "Revoke" alongside "Manage roles" on a platform user. Both are confirmed before applying.
- Create User dialog: a "Platform user (super-admin)" option that provisions a tenant-less platform account and skips tenant selection.
- All of the above appear only when `platformAccess.enabled` is true.

Note that this is a deliberate privilege-escalation surface: with `platformAccess.enabled`, any admin-console operator can make any user — including themselves — a platform super-admin. Restrict console access accordingly.

# Running the demo (visual testing)

Click through the whole auth system in a browser — and exercise **all three
multi-tenancy modes**. Two ways to run it:

- **`pnpm demo`** — zero setup, in-memory database, no Docker. Fastest. (Option A)
- **Docker Compose** — real Postgres, data persists, isolated per mode. (Option B)

## What you get

| Service | URL | What it is |
| --- | --- | --- |
| **React demo** | http://localhost:4200 | End-user UI: signup, login (email / phone / passwordless), MFA, sessions, profile, password reset |
| **Swagger UI** | http://localhost:3333/api | Interactive API docs — hit every endpoint by hand |
| **Admin console** | http://localhost:3333/api/auth/admin | Dashboard: manage users, roles, permissions, tenants, sessions |
| **Postgres** | localhost:5432 | `nestauth` / `nestauth` (Docker option only) |

## Option A — `pnpm demo` (no Docker, fastest)

Boots the backend + the React app against an **in-memory SQLite** database — no
Postgres, no Docker, nothing to install beyond the repo's dependencies.

```bash
pnpm install            # once
pnpm demo               # builds the libs + apps, then runs everything

# pick a tenant mode:
TENANT_MODE=shared   pnpm demo
TENANT_MODE=isolated pnpm demo
```

Then open http://localhost:4200 (React demo), http://localhost:3333/api (Swagger),
http://localhost:3333/api/auth/admin (Admin console). `Ctrl+C` stops both.

> The database is in-memory, so data resets on each restart — ideal for a quick look.
> For persistent data + a separate DB per tenant mode, use Docker (Option B).

## Option B — Docker (persistent Postgres)

### Prerequisites

- Docker Desktop (or Docker Engine + Compose v2).

### Run it

```bash
# from the repo root
docker compose up --build
```

First build takes a few minutes (it installs the workspace and builds the packages,
the admin SPA, and the React app inside the images). Subsequent runs are cached.

Stop with `Ctrl+C`; `docker compose down` to remove containers, `docker compose down -v`
to also wipe the database volume.

## Switch the tenant mode

Each mode runs against its **own database** (`nest_auth_<mode>`), so switching never
mixes data. Set `TENANT_MODE` when you bring the stack up:

```bash
TENANT_MODE=disabled docker compose up --build   # default — single tenant
TENANT_MODE=shared   docker compose up --build   # global users; join/switch tenants
TENANT_MODE=isolated docker compose up --build   # users scoped per tenant
```

(Recreate just the backend after changing the value: `docker compose up -d --build backend`.)

### What to test in each mode

**`disabled`** (single-tenant)
- Signup/login work without any tenant. Sending a `tenantId` is rejected (400).
- `POST /auth/switch-tenant` returns 400.

**`shared`** (global users, multi-tenant)
- In the Admin console, create a couple of tenants and assign a user to both.
- A user is global (one identity); `POST /auth/switch-tenant` swaps the active tenant and the
  user's roles change per tenant. (Drive switch-tenant via Swagger or the Admin console — the
  React app's "Select tenant" screen is currently a minimal stub.)
- The same email cannot register twice (global-unique).

**`isolated`** (users scoped per tenant)
- Signup requires a `tenantId`; the same email can register independently under different tenants.
- `POST /auth/switch-tenant` is rejected (you log in per tenant instead).
- ⚠️ **Known limitation:** full isolation is still being hardened (tracked as `.tasks/019`).
  ISOLATED currently treats `tenantId` more like a tag than a hard DB boundary — useful to
  observe, but don't treat it as production-ready isolation yet.

> Tip: the easiest way to drive tenant scenarios is the **Admin console** (create tenants,
> assign roles) plus **Swagger** (`/auth/signup`, `/auth/login`, `/auth/switch-tenant` with a
> `tenantId`). The React app adapts to the active mode via `GET /auth/client-config`.

## Admin console login

The admin console is **secret-gated**. Create the first admin (Swagger → `POST /auth/admin/signup`,
or curl), using the dev secret from `docker-compose.yml`:

```bash
curl -X POST http://localhost:3333/api/auth/admin/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@demo.test","password":"AdminPass!1","name":"Root","secretKey":"cArX1qCWcih8JVk8P19HT0vTrXnR8HcFPMpzminV/XE="}'
```

Then sign in at http://localhost:3333/api/auth/admin.

## Platform admin (manage the entire platform, full nest-auth features)

The built-in admin console above is a minimal, secret-gated bootstrap admin. For a
**platform super-admin with the full nest-auth feature set** (social login, MFA, RBAC),
the demo ships the recommended pattern in `apps/example-nest/src/platform/`: a normal
`NestAuthUser` holding a platform role (`super_admin`, guard `platform`) granted via the
first-class **`PlatformAccess`** (see [User Access & Platform Access](/docs/concepts/user-access-and-platform-access)),
so it manages everything *above* all tenants.

It's **origin-locked**: platform roles are only resolved when the login comes from the
platform portal — gated by `platformAccess.validate`, which here checks an
`x-platform-portal: true` header. So a leaked token from a normal tenant origin can't be
used as a platform-god token.

A first platform admin is **seeded on boot**: `platform@demo.test` / `PlatformPass!1`
(override with `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD`).

```bash
# log in THROUGH the platform portal (the x-platform-portal header is the origin-lock).
# This user is a full nest-auth user — it can also enable MFA, use social login, etc.
TOK=$(curl -s -X POST http://localhost:3333/api/auth/login \
  -H 'Content-Type: application/json' -H 'x-platform-portal: true' \
  -d '{"providerName":"email","credentials":{"email":"platform@demo.test","password":"PlatformPass!1"}}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')

curl -s http://localhost:3333/api/platform/stats   -H "Authorization: Bearer $TOK"   # cross-tenant counts
curl -s http://localhost:3333/api/platform/tenants -H "Authorization: Bearer $TOK"   # ALL tenants
curl -s http://localhost:3333/api/platform/users   -H "Authorization: Bearer $TOK"   # ALL users
# grant another user platform access (only a platform admin can):
curl -s -X POST http://localhost:3333/api/platform/grant-admin -H "Authorization: Bearer $TOK" \
  -H 'Content-Type: application/json' -d '{"email":"someone@demo.test"}'
```

Security boundaries (all in `test/platform-admin.e2e-spec.ts`): a tenant user hitting
`/api/platform/*` → **403**; the same super-admin logging in **without** the portal header → **403**
(origin-lock); a non-platform user logging in **with** the header → **403 `ACCESS_DENIED`**; and a
tenant user can never grant themselves the role.

### Configurable policy

The platform portal is policy-driven (env in the demo; a config service in your app):

| Var | Default | Effect |
| --- | --- | --- |
| `PLATFORM_REQUIRE_MFA` | `false` | When `true`, a platform admin must have **MFA enabled** to use `/platform/*` (else `403 PLATFORM_MFA_REQUIRED`). |
| `PLATFORM_ADMIN_ENABLED` | `true` | `false` doesn't mount the portal at all. |
| `PLATFORM_ADMIN_SEED` | `true` | `false` skips auto-creating the first admin (seed it yourself). |
| `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` | demo values | The seeded first admin. |

```bash
PLATFORM_REQUIRE_MFA=true pnpm demo    # platform admins must enable MFA first
```

Because platform admins are full nest-auth users, "require MFA" reuses the real MFA flow:
enrol TOTP (`/auth/mfa/setup-totp` → verify → toggle), then every login goes through the MFA
challenge before the portal opens.

## How it's wired (and why)

- **Token mode = header.** The React SPA (`:4200`) talks to the API (`:3333`) cross-origin over
  http. httpOnly `SameSite=Lax` cookies are *not* sent on cross-site XHR, so the demo uses
  header-mode tokens (`Authorization: Bearer`). The admin console is same-origin on `:3333`, so it
  uses cookies.
- **`VITE_API_BASE_URL` is baked at build time** to `http://localhost:3333/api` — it must be the
  URL your *browser* uses, not a compose hostname, because the SPA runs in your browser.
- **`synchronize: true`** auto-creates the schema on first connect, so there are no migrations to run.

## Configuration knobs (compose env)

| Var | Default | Notes |
| --- | --- | --- |
| `TENANT_MODE` | `disabled` | `disabled` / `shared` / `isolated` |
| `JWT_SECRET` | dev value | change for anything real |
| `ADMIN_CONSOLE_SECRET_KEY` | dev value | gate for `POST /auth/admin/signup` |
| `DB_*` | postgres service | host/port/user/pass/name |

## Troubleshooting

- **Port already in use** (`3333`, `4200`, `5432`): stop the conflicting process or edit the
  `ports:` mappings in `docker-compose.yml`.
- **Login works in Swagger but not the React app**: confirm the backend is reachable at
  http://localhost:3333/api from your browser and that CORS allows `http://localhost:4200`
  (it does by default in `apps/example-nest/src/main.ts`).
- **Switched tenant mode but see old data**: each mode has its own DB; if you want a clean slate
  for a mode, `docker compose down -v` then bring it back up.
- **Add the Next.js demo**: `apps/example-next` uses cookie-mode/SSR and defaults to `:3000`;
  it isn't in this compose yet — add a service modeled on `web` with `NEXT_PUBLIC_API_URL`.

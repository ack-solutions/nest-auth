# Security Review: Email Handling, Signup/Login Abuse Controls — `@ackplus/nest-auth`

Prepared for the library maintainer. Scope: `packages/nest-auth/src`. Every claim below is grounded in the current source (file:line references throughout). All proposed config keys/hooks are marked **PROPOSED** and are designed to be **opt-in and backward compatible** with the existing `emailAuth` / `otp` / `registration` / `password` option blocks, the `createUserCore` choke point, the `EmailAuthProvider` seam, and the event bus.

---

## TL;DR

- **What's already solid:** Password hashing (argon2id, tuned to OWASP-plus defaults, fully configurable — `user.entity.ts:326-331`), reset-token design (HMAC-bound to the current password hash, single-use, revokes all sessions — `password.service.ts:77-83,347-365`), and a rich, idiomatic extensibility surface (deep-merged options + hooks + `EventEmitter2` bus).
- **Case-insensitive email login: YES, we already do it** — correctly and safely, via `normalizedEmail()` (`normalize.util.ts:5-9`) applied consistently on both the store and lookup sides. This is the one email question where we're fine.
- **Biggest gap:** There is **no DB uniqueness constraint anywhere** on email/identity (`identity.entity.ts` has zero indexes; `users.email` is a non-unique `@Index` — `user.entity.ts:33-35`). Uniqueness is app-layer check-then-insert with the existence check *outside* the create transaction (`auth.service.ts:176` vs `208`) — a real TOCTOU race that produces duplicate accounts. The code itself admits this (`user.service.ts:318-321`). This undermines every normalization/canonicalization control layered on top.
- **Runner-up gaps (all P0-ish):** zero rate limiting / lockout / CAPTCHA; OTP send-abuse (email bombing / SMS pumping) because `createOtp` regenerates unconditionally with no cooldown (`otp-flow.service.ts:80-101`); OTP verify brute-force (6-digit codes, 10-min window, no attempt cap, no `attempts` column — `otp.entity.ts`, `otp-flow.service.ts:128-152`).
- **Top 3 actions:** (1) Add a **composite UNIQUE index** on identity `(provider, providerId)` + catch the DB unique-violation as the authoritative `EMAIL_ALREADY_EXISTS`. (2) Wire the **8054-domain disposable list** as an opt-in `emailAuth.disposable` gate. (3) Add **OTP send-cooldown + verify attempt-cap** (`attempts` column + CSPRNG). Then layer canonicalization, rate limiting, pwned-password screening, and verification gating.

---

## Direct answers to your four questions

### 1. The disposable-emails list (8054 domains) — usable? How do we block fake signups in prod?

**Usable: yes, as a coarse baseline — but ship it opt-in and be honest about coverage.** Today the library has **zero** disposable-email defense: `normalizedEmail()` is trim+lowercase only (`normalize.util.ts:5-9`), `emailAuth` config is just `{ enabled: boolean }` (`auth-module-options.interface.ts:454-456`), and no CSV or blocklist code is wired anywhere. The only extension point is `registrationHooks.beforeSignup` (`auth.service.ts:125-128`) whose own JSDoc literally shows a consumer hand-rolling an email banlist.

Honest caveats:
- **8054 is small.** Commercial/OSS lists track 100k–320k+ domains (ivolo ~324k, Clerk's live DB ~160k). Your list will miss a lot, especially dynamic-DNS burner hosts.
- **False positives happen** (lists occasionally include legit ESPs). An **allowlist override** and a non-blocking **`mode: 'flag'`** (allow + emit event) are mandatory for safe rollout.
- **It does nothing about Gmail dot/+tag aliasing** — that's canonicalization (question 2/4), a separate feature.

**How to block in production (recommendation):** an opt-in `DisposableEmailService` + a **PROPOSED** `emailAuth.disposable` config block, enforced on the **register path only** (never on login — that just locks out already-registered users for zero benefit). Enforce in `AuthService.signup()` after `beforeSignup`, and *also* in `resolveOrCreateUserForSend()` on the new-user branch so passwordless auto-signup is covered. Do **not** enforce in `createUserCore`/`user.beforeCreate` — that path also serves admin-created and social-OAuth (trusted) identities that must not be blocked. Ship the list as a **build-time-generated TS module** (`import()`-loaded lazily), never `fs`-read at runtime (breaks under webpack/esbuild/serverless bundling). Code sketch in Detailed Recommendations §A.

### 2. Gmail dots — is it a real issue? Can a user put a dot anywhere and still get the mail?

**Yes, it's real and it applies to us today.** Google ignores every dot in the local part of a `gmail.com`/`googlemail.com` address: `chetan@gmail.com`, `c.hetan@gmail.com`, and `c.h.e.t.a.n@gmail.com` all deliver to the same inbox. Our `normalizedEmail()` is trim+lowercase only (`normalize.util.ts:5-9`), so those become **three distinct identities/users** for one real mailbox — free-trial farming, quota/referral abuse, ban evasion.

**Important nuance (why a naive fix is dangerous):** dot-equivalence is **only** true for Gmail/Googlemail. RFC 5321 §2.4 makes the *domain* case-insensitive (lowercasing it is always safe), but the *local part* is owned by the receiving server and is technically case- and dot-**significant** for everyone else. Stripping dots for `outlook.com`/corporate/custom domains would **merge two legitimately different people** into one account.

**How others fix it:** compute a **separate canonical key** used only for uniqueness/lookup, while still storing and sending mail to the address the user typed. Provider-aware rules (validator.js `normalizeEmail`, `email-normalizer`, Rails `normalizes`): Gmail → strip dots + strip `+tag` + fold `googlemail.com`→`gmail.com`; everything else → lowercase only. Clerk ships it as a distinct dashboard toggle, separate from disposable blocking. Recommendation + code in Detailed Recommendations §B (opt-in `emailAuth.canonicalize`).

### 3. Case-insensitive email matching — are WE doing it today?

**Yes — plainly, we are, and it's done correctly.** Evidence:
- `normalizedEmail(email) = email.trim().toLowerCase()` (`normalize.util.ts:5-9`).
- **Store side:** `createUserCore` normalizes the email, saves `users.email` normalized, and creates the email identity row with the *same* normalized value (`user.service.ts:134,169,195`). The entity `@BeforeInsert/@BeforeUpdate` hook also lowercases `users.email` (`user.entity.ts:98-104`).
- **Lookup side:** `EmailAuthProvider.validate()` normalizes `credentials.email` before lookup (`email-auth.provider.ts:46-53`), and `findIdentity` re-normalizes (`:29-36`) then does exact-equality on `providerId`.

Because the **same function** runs on both sides, `Foo@X.com`, `foo@x.com`, and `  foo@x.com ` all collapse to one account on both register and login. There's even a raw-`providerUserId` fallback for legacy unnormalized rows (`email-auth.provider.ts:35`).

**Two honest footnotes:** (a) this is enforced by *app code*, not the DB — a raw repo write that bypasses the service/entity could store an unnormalized `identity.providerId` (the `@BeforeInsert` hook only touches `users.email`, not the identity row). (b) `String.toLowerCase()` is locale-independent and fine for ASCII but doesn't do Unicode NFC/IDN folding — different Unicode forms of the "same" address are still distinct. Both are minor next to the missing DB constraint.

### 4. `+` subaddressing (`chetan+1@gmail.com`) — what about it?

**Same class of problem as Gmail dots, and equally unhandled.** Gmail strips everything from the first `+` to the `@`, so `chetan+anything@gmail.com` all deliver to `chetan@gmail.com`. Combined with dots the alias multiplier is effectively unbounded. Our `normalizedEmail()` does not strip tags, so each `+tag` is a new account.

**Key caveat — do NOT strip `+` globally.** `+` is a legal local-part character (RFC 5322); subaddressing (RFC 5233) is **optional and provider-specific**. Some corporate/legacy mailboxes provision real addresses containing `+`. Providers also differ: Gmail/Outlook/iCloud/Proton/Fastmail honor `+`, **Yahoo historically used `-`**, and Fastmail also supports subdomain addressing (`tag@user.fastmail.com`) that a `+` rule won't catch. So `+tag` stripping must be **per-provider and opt-in**, folded into the same `emailAuth.canonicalize` feature as the dots fix (§B), producing a canonical key — never mutating the deliverable address (losing the `+tag` also breaks the user's own inbox filters).

---

## Master table — every concern

| # | Concern | Real for us? | What we do today | Risk | Recommended fix | Prio | Effort |
|---|---------|--------------|------------------|------|-----------------|------|--------|
| 1 | **No DB uniqueness** on identity/email | **Yes** | App-layer check-then-insert; check *outside* create txn (`auth.service.ts:176,208`); `identity.entity.ts` no index; `users.email` non-unique `@Index` (`user.entity.ts:33`) | Concurrent signups race → duplicate users + identities; undermines all dedup | Composite UNIQUE `(provider, providerId)`; catch 23505 as `EMAIL_ALREADY_EXISTS`; opt-in migration + reconcile | **P0** | M |
| 2 | **No rate limiting / throttling** | Yes | None; no `@nestjs/throttler` dep; `ApiTooManyRequests` is Swagger-only (`api-responses.decorator.ts:46`) | Credential stuffing, spraying, brute force unimpeded | Opt-in `security.rateLimit` w/ pluggable store (memory default, Redis); key login by identifier+IP, progressive backoff | **P0** | M–L |
| 3 | **OTP send-abuse** (email bomb / SMS pumping) | Yes | `createOtp` deletes+regenerates unconditionally, no cooldown/cap (`otp-flow.service.ts:80-101`); several `@Public()` routes | Unlimited email bombing; SMS toll fraud | Cooldown (60s) + per-record/identifier+IP daily caps; generic success when throttled | **P0** | S–M |
| 4 | **OTP/MFA verify brute-force** | Yes | 6-digit numeric, 10-min window, wrong code not counted; no `attempts` column (`otp.entity.ts`, `otp-flow.service.ts:128-152`) | ~10⁶ space guessable in window (reset, verify, passwordless, MFA) | Add `attempts` column + `maxAttempts` (5), invalidate on exhaustion; CSPRNG (`utils/otp.ts:5` uses `Math.random()`) | **P0** | M (schema) |
| 5 | **Signup enumeration** | Yes | Distinct 400 `EMAIL_ALREADY_EXISTS` "…in this tenant" vs 200 (`auth.service.ts:180-185`) | Reveals which emails have accounts | Opt-in `registration.enumerationSafe`: generic 202 + out-of-band "account exists" email | **P0** | M |
| 6 | **Login timing oracle** | Yes | argon2 verify runs only when identity+hash exist; unknown email returns early, no dummy hash (`email-auth.provider.ts:46-82`) | Latency distinguishes real vs unknown email | Dummy argon2 verify against fixed decoy hash on miss | **P1** | S |
| 7 | **Disposable domains** | Yes | 8054 CSV not wired; no config (`emailAuth = {enabled}`) | Throwaway/fake signups, metric/free-tier abuse | Opt-in `emailAuth.disposable` (§A); enforce on register paths only | **P1** | M |
| 8 | **Gmail dot / +tag aliasing** | Yes | `normalizedEmail` trim+lowercase only (`normalize.util.ts:5-9`) | 1 mailbox → unlimited accounts | Opt-in provider-aware `emailAuth.canonicalize` + separate canonical key (§B) | **P1** | M–L |
| 9 | **Case-insensitive matching** | **No (OK)** | Consistent `normalizedEmail` on both sides | — (minor: app-level only, no NFC/IDN) | Keep; optionally add NFC + IDN `toASCII` to canonical key | — | — |
| 10 | **Breached-password (HIBP) check** | Yes | None (no pwned/hibp/zxcvbn dep) | Users reuse leaked passwords | Opt-in `password.policy.checkBreached` via HIBP k-anonymity Range API, fail-open (§D) | **P1** | S–M |
| 11 | **Weak/inconsistent password policy** | Yes | Only `@MinLength(8)`; login creds not even MinLength (`email-credentials.dto.ts:21-23`); admin DTO stricter than user (`admin-console/dto/signup.dto.ts:22-26`) | Weak passwords; argon2 DoS from unbounded input | `password.policy {minLength,maxLength~128,blocklist,checkBreached}` applied uniformly to signup/change/reset | **P1** | M |
| 12 | **Verification gating** | Yes | Unverified users get tokens at signup; guard/login never check `emailVerifiedAt`; `EMAIL_NOT_VERIFIED` is dead code (`auth.constants.ts:44`) | Unverified accounts reach protected routes; weakens anti-abuse | Opt-in `registration.requireVerifiedEmail` + `@SkipVerification` (mirror `mustChangePassword.enforce`) | **P1** | M |
| 13 | **Bot signups / CAPTCHA** | Yes | None | Automated fake-account creation | Opt-in pluggable `security.captcha.verify(token,ip)` (Turnstile/hCaptcha/reCAPTCHA-agnostic) + honeypot | **P1** | M |
| 14 | **Nested-DTO validation / mass assignment** | Yes | Library ships no `ValidationPipe`; login `credentials` only `@IsObject()` (`login.request.dto.ts:65-71`); signup `[x:string]:any` index sig; no `@MaxLength` on email/password | Nested rules never run; unbounded password → argon2 DoS | `@ValidateNested()+@Type()` discriminated union; remove index sig; `@MaxLength`; document recommended pipe | **P1** | S–M |
| 15 | **Account lockout** | Yes | None; only `LOGIN_FAILED` emit (`auth.service.ts:454-485`) | Unlimited per-account guesses | Prefer **soft/temporary** lockout + backoff + CAPTCHA (avoid lockout-DoS); ship reference `LOGIN_FAILED` consumer | **P1** | M |
| 16 | **Passwordless-send enumeration** | Yes | Generic normally, but 403 `REGISTRATION_DISABLED` for unknown when `allowSignUp=true & registration.enabled=false` (`auth.service.ts:528-534,563-569`) | Existence leak in that config combo | Return same generic response regardless of registration state | P2 | S |
| 17 | **Refresh-token rotation + reuse detection** | Verify | Issues access+refresh; revoke-all on password change/reset | If rotation/reuse-detection absent → replay risk | Confirm; if missing, add rotation + family-revoke-on-reuse (short grace window) | P1 | M |
| 18 | **Reset-token replay window** | Minor | Single-use via hash rotation + OTP gate; replayable for TTL until pw changes (`jwt.service.ts:130-158`) | Small residual replay | Shorten TTL; mark consumed on first reset; align OTP 30m-doc vs 10m-code (`otp-flow.service.ts:87`) | P2 | S |
| 19 | **Unicode/IDN normalization** | Minor | None (`toLowerCase` only) | Different Unicode forms distinct | NFC + domain `toASCII` in canonical key (§B); leave confusable-folding as optional warn signal | P2 | S |
| 20 | **Audit logging** | Partial (OK) | Rich event bus + `audit.onEvent`; `LOGIN_FAILED` carries ip/ua/reason | Emit-only, nothing reacts | Document reference lockout/monitoring consumer; never log secrets | P2 | S |

---

## Detailed recommendations (P0 / P1)

> Everything below is **opt-in** and defaults to today's behavior. Config additions rely on `AuthConfigService`'s deep-merge (`auth-config.service.ts:117-119`), so nested blocks are automatically backward compatible. **Watch the deepmerge array-concat footgun** — any array-valued option must be de-duped in `setOptions()`, exactly as the code already does for `mfa.methods` (`:122-124`) and `roleGuards` (`:126-131`).

### A. Disposable-email blocking (concern 7)

**PROPOSED** config, extending `emailAuth` (`auth-module-options.interface.ts:454`):

```ts
emailAuth?: {
  enabled: boolean;
  disposable?: {
    enabled?: boolean;          // default false — fully backward compatible
    mode?: 'block' | 'flag';    // 'flag' = allow + emit event (safe rollout). default 'block'
    blockSubdomains?: boolean;  // foo.dynv6.net -> dynv6.net. default true
    useBundledList?: boolean;   // the 8054 list. default true
    extraDomains?: string[];    // extend
    domains?: string[];         // replace bundled list entirely
    allowlist?: string[];       // always wins over blocklist
    isDisposable?: (domain: string, email: string) => boolean | Promise<boolean>; // optional MX/Kickbox/ZeroBounce resolver
  };
};
```

```ts
// src/lib/core/services/disposable-email.service.ts
@Injectable()
export class DisposableEmailService {
  private blockSet = new Set<string>();
  private allowSet = new Set<string>();
  private ready = false;
  private cfg = () => AuthConfigService.getOptions().emailAuth?.disposable;

  private norm = (d: string) => { const s = d.trim().toLowerCase(); try { return toASCII(s); } catch { return s; } };

  private async ensureLoaded() {
    if (this.ready) return;
    const c = this.cfg();
    const base = c?.domains?.length ? c.domains
      : c?.useBundledList === false ? []
      : (await import('../data/disposable-domains.generated')).DISPOSABLE_DOMAINS; // lazy: disabled consumers pay nothing
    this.blockSet = new Set([...base, ...(c?.extraDomains ?? [])].map(this.norm));
    this.allowSet = new Set((c?.allowlist ?? []).map(this.norm));
    this.ready = true;
  }

  private suffixHit(domain: string, set: Set<string>, parents: boolean): boolean {
    if (set.has(domain)) return true;
    if (!parents) return false;
    const p = domain.split('.');
    for (let i = 1; i < p.length - 1; i++) if (set.has(p.slice(i).join('.'))) return true; // never test bare TLD
    return false;
  }

  async isDisposable(email: string): Promise<boolean> {
    const c = this.cfg();
    if (!c?.enabled || !email) return false;
    const domain = this.norm(email.slice(email.lastIndexOf('@') + 1));
    if (!domain) return false;
    await this.ensureLoaded();
    if (this.suffixHit(domain, this.allowSet, true)) return false;         // allowlist wins
    if (this.suffixHit(domain, this.blockSet, c.blockSubdomains !== false)) return true;
    if (c.isDisposable) return !!(await c.isDisposable(domain, email));     // optional resolver
    return false;
  }
}
```

Enforcement — in `AuthService.signup()`, right after `beforeSignup` (`auth.service.ts:125-128`), **before** the dup loop; and in `resolveOrCreateUserForSend()` on the **new-user branch only**:

```ts
if (email && (await this.disposableEmail.isDisposable(email))) {
  const d = this.authConfig.emailAuth?.disposable;
  if (d?.mode === 'flag') await this.eventEmitter.emitAsync(NestAuthEvents.DISPOSABLE_EMAIL_DETECTED, { email });
  else throw new ForbiddenException({ message: 'This email domain is not allowed', code: ERROR_CODES.EMAIL_DOMAIN_NOT_ALLOWED });
}
```

**Build-time list generation** (`scripts/build-disposable-list.ts`): read the CSV (`domain,source,created_at`), keep column 0, lowercase+dedupe, write `export const DISPOSABLE_DOMAINS: readonly string[] = Object.freeze([...])` to `src/lib/core/data/disposable-domains.generated.ts`. Add it to `package.json` `files` and the nx/tsc asset copy or it won't ship in `dist`. Do **not** read the CSV at runtime.

**Tradeoffs to document:** static list is a coarse baseline (8054 « commercial 160k+); false positives → keep `allowlist` + `flag` mode; register-only (never login); does not address aliasing (that's §B).

### B. Provider-aware canonical email (concerns 8 & 4; Unicode 19)

Two-value model: keep `identity.providerId` = normalized-for-lookup email (unchanged, preserves the raw fallback), keep `users.email` = what the user typed (for display/sending), add a **new derived `canonicalEmail`** carrying the aggressive key, and put the UNIQUE index on the canonical key (§ Migration).

**PROPOSED** config (default OFF / conservative — aggressive rules off by default):

```ts
emailAuth.canonicalize?: {
  enabled?: boolean;             // default false
  lowercase?: boolean;          // default true (today's behavior)
  nfc?: boolean;                // default true — safe, deterministic
  idnToAscii?: boolean;         // default true — domain punycode/UTS-46
  gmailRemoveDots?: boolean;    // default FALSE (opt-in; gmail/googlemail only)
  subaddressProviders?: Record<string,string>; // domain -> separator ('+' or '-'); NOT global. default {}
  rewriteDomains?: Record<string,string>;       // e.g. googlemail.com -> gmail.com
  custom?: (email: string) => string | null;    // escape hatch
};
```

```ts
// src/lib/utils/normalize.util.ts  — ADD alongside normalizedEmail (do NOT change normalizedEmail)
const GMAIL = new Set(['gmail.com', 'googlemail.com']);

export function canonicalEmail(email: string | null | undefined, cfg: EmailCanonicalizeConfig = {}): string | null {
  const base = normalizedEmail(email);                // reuse the existing safe trim+lowercase
  if (!base) return null;
  if (cfg.custom) return cfg.custom(base);
  let v = cfg.nfc !== false ? base.normalize('NFC') : base;
  const at = v.lastIndexOf('@');                       // LAST '@' — quoted locals may contain '@'
  if (at <= 0 || at === v.length - 1) return v;
  let local = v.slice(0, at);
  let domain = v.slice(at + 1).toLowerCase();
  if (cfg.idnToAscii !== false) { try { domain = toASCII(domain); } catch { /* leave */ } }
  if (cfg.rewriteDomains?.[domain]) domain = cfg.rewriteDomains[domain];
  const sep = cfg.subaddressProviders?.[domain];      // provider-aware +/- strip, NEVER global
  if (sep) { const i = local.indexOf(sep); if (i > 0) local = local.slice(0, i); }
  if (cfg.gmailRemoveDots !== false && GMAIL.has(domain)) local = local.replace(/\./g, '');
  if (!local) return base;                             // never emit empty local part
  return `${local}@${domain}`;
}
```

Matching seam — extend the existing normalized-then-raw ladder in `EmailAuthProvider.findIdentity` (`email-auth.provider.ts:29-36`):

```ts
if (cfg?.enabled) {
  const canon = canonicalEmail(providerUserId, cfg);
  if (canon) { const hit = await super.findIdentity(canon, tenantId); if (hit) return hit; } // canonical first
}
const norm = normalizedEmail(providerUserId);
if (norm) { const hit = await super.findIdentity(norm, tenantId); if (hit) return hit; }      // normalized (BC)
return super.findIdentity(providerUserId, tenantId);                                          // legacy raw
```

Store side — in `createUserCore` (`user.service.ts:134`), set `identity.canonicalEmail = cfg?.enabled ? canonicalEmail(rawEmail, cfg) : undefined`; keep `providerId = normalizedEmail(...)`; keep `users.email` = what the user typed. Dedup check compares on `canonicalEmail` when enabled.

**Non-negotiable tradeoffs:** never overwrite the deliverable address; `gmailRemoveDots`/subaddress default **off** and scoped to known providers only (blindly folding non-Gmail domains merges distinct real people); Yahoo uses `-` not `+`; store side and match side must use the **same** `canonicalEmail`+config or you reintroduce a register/login mismatch.

### C. Case-insensitive audit — the one fix worth making (concern 9)

We're already correct. The only hardening worth doing: add a `@Transform` on the DTOs so normalization is also visible at the edge (and to fix concern 14's login path), and treat the service/entity as the enforcement floor. Keep `normalizedEmail`'s meaning unchanged — existing rows and the raw fallback depend on it.

### D. Pwned-password + unified policy (concerns 10, 11)

```ts
async function isPwned(password: string, addPadding = true): Promise<boolean> {
  const sha1 = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const res = await fetch(`https://api.pwnedpasswords.com/range/${sha1.slice(0,5)}`,
    { headers: addPadding ? { 'Add-Padding': 'true' } : {} });
  if (!res.ok) return false;                            // fail-open (configurable) — HIBP outage must not block signup
  for (const line of (await res.text()).split('\n')) {
    const [suf, count] = line.trim().split(':');
    if (suf === sha1.slice(5) && Number(count) > 0) return true; // padding rows have count 0
  }
  return false;
}
// Applied UNIFORMLY on signup + change + reset (fixes admin-vs-user inconsistency and unbounded-argon2 DoS):
async function assertPasswordAllowed(pw: string, ctx: {email?: string}, p: IPasswordPolicyOptions) {
  if (pw.length < (p.minLength ?? 8))  throw new BadRequestException({ code: 'PASSWORD_TOO_SHORT' });
  if (pw.length > (p.maxLength ?? 128)) throw new BadRequestException({ code: 'PASSWORD_TOO_LONG' });
  const local = ctx.email?.split('@')[0]?.toLowerCase();
  if ([...(p.blocklist ?? []), local].filter(Boolean).some(w => pw.toLowerCase().includes(w!)))
    throw new BadRequestException({ code: 'PASSWORD_BLOCKLISTED' });
  if (p.checkBreached && await isPwned(pw)) throw new BadRequestException({ code: 'PASSWORD_BREACHED' });
}
```

NIST SP 800-63B alignment: favor length (min 8, allow ≥64), no forced composition/rotation, **do** screen against a breach + context blocklist. Cap `maxLength` (~128) to stop the argon2 DoS — the full password never leaves the process (k-anonymity: only the 5-char hash prefix is sent).

### E. OTP hardening (concerns 3, 4)

```ts
// otp.entity.ts:  @Column({ default: 0 }) attempts: number;
// utils/otp.ts numeric branch — CSPRNG, not Math.random():
const code = Array.from({ length: len }, () => randomInt(0, 10)).join('');
// OtpFlowService.createOtp — cooldown + daily cap BEFORE regenerating:
const existing = await this.otpRepo.findOne({ where: { userId, type } });
if (existing && Date.now() - existing.createdAt.getTime() < (cfg.cooldownSec ?? 60) * 1000) return; // generic success
// validateAndConsume — count + invalidate on exhaustion (atomic update to survive concurrent verifies):
if (!matches) {
  otp.attempts += 1;
  if (otp.attempts >= (cfg.maxAttempts ?? 5)) { await this.otpRepo.remove(otp); throw new BadRequestException({ code: 'OTP_MAX_ATTEMPTS' }); }
  await this.otpRepo.save(otp);
  throw new BadRequestException({ code: 'OTP_INVALID' });
}
```

`@Public()` send routes (`passwordless/send`, `forgot-password`) mean send-throttling must key on **identifier + IP**, not per-user only.

### F. Login timing oracle + enumeration-safe signup (concerns 6, 5) + DB backstop (concern 1)

```ts
// email-auth.provider.ts validate() — equalize cost on unknown email:
const DECOY = '$argon2id$v=19$m=65536,t=3,p=4$ZGVjb3lzYWx0$ZGVjb3loYXNoZGVjb3loYXNo';
const hash = identity?.user?.passwordHash;
if (!hash) { await verifyArgon2(DECOY, credentials.password).catch(() => {}); throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' }); }

// identity.entity.ts — the authoritative backstop:
@Index('UQ_identity_provider_providerId', ['provider', 'providerId'], { unique: true })

// auth.service.ts signup() — catch the DB violation as the source of truth:
try { user = await this.userService.createUserCore(dto); }
catch (e) {
  if (isUniqueViolation(e)) {
    if (cfg.registration.enumerationSafe) { await this.sendAccountExistsEmail(dto.email); return genericAccepted(); } // 202
    throw new BadRequestException({ code: 'EMAIL_ALREADY_EXISTS' });
  }
  throw e;
}
```

### G. Nested-DTO validation (concern 14)

```ts
// login.request.dto.ts — make nested rules actually run + let whitelist strip extras:
@ValidateNested()
@Type(() => Object, { discriminator: { property: 'type',
  subTypes: [{ value: EmailCredentialsDto, name: 'email' }, { value: PhoneCredentialsDto, name: 'phone' }] } })
credentials!: EmailCredentialsDto | PhoneCredentialsDto;
// EmailCredentialsDto.password: add @MaxLength(128).  signup DTO: remove `[x: string]: any` index signature.
```

This is a behavior change (previously-accepted malformed payloads now 400) — call it out in release notes. Document the recommended global `ValidationPipe` (`whitelist:true, forbidNonWhitelisted:true, transform:true`).

### H. Verification gating (concern 12)

Wire the dead `EMAIL_NOT_VERIFIED` constant: opt-in `registration.requireVerifiedEmail` either withholds session tokens at signup until verified, or has `NestAuthAuthGuard` reject unless the route carries a **PROPOSED** `@SkipVerification()` decorator — mirroring the existing `mustChangePassword.enforce` + `@SkipMustChangePassword` pattern (`auth.guard.ts:155-170`).

---

## Prioritized roadmap

**P0 — abuse + integrity (do first):**
- DB uniqueness backstop: composite UNIQUE `(provider, providerId)` + catch 23505 → `EMAIL_ALREADY_EXISTS`. Opt-in migration + reconcile step. **~M** (schema + dedup tooling).
- OTP send-throttle in `createOtp` (cooldown + daily caps, generic success). **~S–M.**
- OTP verify attempt-cap (`attempts` column + `maxAttempts`) + CSPRNG for numeric codes. **~M** (schema).
- `security.rateLimit` block, pluggable store (memory default, Redis adapter). **~M–L.**
- Enumeration-safe signup (`registration.enumerationSafe`) + dummy-argon2 on unknown-email login. **~M.**

**P1 — policy + hardening:**
- `password.policy {minLength,maxLength,blocklist,checkBreached}` (HIBP, fail-open) applied uniformly to signup/change/reset. **~M.**
- `emailAuth.disposable` (8054 list, opt-in, register paths only). **~M.**
- `emailAuth.canonicalize` (provider-aware, separate canonical key). **~M–L.**
- `registration.requireVerifiedEmail` + `@SkipVerification`. **~M.**
- Pluggable `security.captcha` verifier + honeypot. **~M.**
- Nested-DTO validation fix + `@MaxLength` + index-signature removal. **~S–M.**
- Confirm/add refresh-token rotation + reuse detection. **~M.**
- Soft/temporary lockout + reference `LOGIN_FAILED` consumer. **~M.**

**P2 — residual + docs:**
- Passwordless-send enumeration differential; align OTP 30m-doc vs 10m-code; shorten reset TTL + mark consumed; Unicode NFC/IDN in canonical key; document audit/no-secret-logging. **~S each.**

---

## Migration & backward-compatibility notes

- **Everything defaults to today's behavior.** Deep-merge (`auth-config.service.ts:117-119`) makes nested additions backward compatible; flipping any feature on is a semantic change and must be changelogged (e.g. two previously-distinct Gmail aliases suddenly collide once `canonicalize.enabled`).
- **deepmerge concatenates arrays.** Any new list option (`disposable.domains/allowlist`, `subaddressProviders`, `password.blocklist`) must be de-duped in `setOptions()` like the existing `mfa.methods`/`roleGuards` workarounds, and you must decide replace-vs-extend semantics explicitly.
- **The unique index cannot be auto-synced onto live data.** The library ships no migrations and relies on TypeORM `synchronize`; a populated table almost certainly has duplicates, so a decorator + sync would **throw and wedge boot** for every consumer. Gate it behind a **PROPOSED** `emailAuth.enforceUniqueIndex` flag and/or ship a `CREATE UNIQUE INDEX CONCURRENTLY` migration run **only after** backfill + collision resolution.
- **Zero-downtime sequence for canonical uniqueness:** add nullable `canonicalEmail` column → backfill in batches (idempotent `WHERE canonicalEmail IS NULL`) → **detect collisions** (`GROUP BY canonicalEmail HAVING COUNT(*) > 1`) → **resolve them as a product decision** (the library must *report* collisions and offer a `mergeIdentities()` helper, never silently merge — silent merge can hand one user's account to another) → only then add the UNIQUE index CONCURRENTLY.
- **Keep the normalized-then-raw `findIdentity` fallback untouched throughout** — it's what lets legacy/unnormalized rows keep authenticating while `canonicalEmail` is being backfilled.
- **Cross-DB caveat:** partial unique index (`WHERE canonicalEmail IS NOT NULL`) is Postgres syntax. The library targets multiple drivers via TypeORM — either document Postgres-only for the constraint, backfill all email rows (no NULLs) and use a full unique index, or ship per-driver migrations.
- **HIBP / disposable resolver / MX checks** must be timeout-bounded and fail-open, and must never sit synchronously in the request path as hard blockers beyond the static list. Deliverability (MX/SMTP) belongs in an async event hook, never a signup-blocking call.
- **Lockout-DoS:** prefer temporary soft lockout + backoff + CAPTCHA over permanent lock; scope partly by IP so an attacker can't lock a victim out by deliberately failing their login.
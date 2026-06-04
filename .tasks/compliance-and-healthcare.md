---
id: compliance-and-healthcare
priority: P0
area: security-compliance
status: design
package: '@ackplus/nest-auth'
title: Compliance assessment for healthcare (HIPAA / NIST 800-63B / GDPR / India DPDP / ABDM) + gap plan
---

## Summary

Assessment of `@ackplus/nest-auth`'s **auth/identity controls** against the compliance frameworks relevant to a Hospital Management System (HMS), grounded in the actual code (verified 2026-05-21), plus a prioritized gap-closure plan so the package can be a **compliance-ready standard auth module** for healthcare and other regulated use cases.

> **This is the healthcare deep-dive within a broader, universal compliance posture.** The package is used widely (SaaS, fintech, gov, education), so the controls here are framework-agnostic: the same set satisfies the auth slice of **OWASP ASVS L2, NIST 800-63B AAL2, SOC 2, ISO 27001, PCI-DSS, GDPR, India DPDP, CCPA, HIPAA, PSD2-SCA**. The package anchors on **ASVS L2 + NIST 800-63B AAL2** and maps everything else to them. The **consumer-facing posture statement** (shipped vs configurable vs roadmap, per control, with the full cross-framework matrix) lives in the docs site: `apps/docs/content/docs/production/compliance.mdx`. This file is the internal gap-plan + HIPAA depth.

> **Read this first — the shared-responsibility reality.** No npm package can be "HIPAA certified." HIPAA / GDPR / DPDP compliance is a property of the **whole system + organization** (administrative, physical, and technical safeguards + BAAs + policies). What this package can and should do is provide the **technical safeguards for identity & access** (HIPAA §164.312 (a), (b), (d), (e)) so the consumer app + deployment + org policies can complete the picture. This doc scopes the package's part.

---

## Frameworks in scope for an HMS

| Framework | Why | Package-relevant part |
|---|---|---|
| **HIPAA Security Rule** (45 CFR §164.312) | US PHI | Technical safeguards: access control, audit controls, authentication, transmission security |
| **NIST SP 800-63B** | The authority on authentication assurance (AAL2 expected for PHI) | Password rules, MFA, rate-limiting, reauthentication |
| **HITECH** | Strengthens HIPAA (breach, audit) | Audit trail completeness + retention |
| **GDPR** | If any EU data subjects | Consent, data export, erasure, records of processing |
| **India DPDP Act 2023** | Indian hospital | Consent, data principal rights, breach reporting |
| **ABDM / ABHA** (India national health stack) | If integrating | ABHA identity + Consent Manager — best as an optional plugin |
| **SOC 2 / ISO 27001** | Vendor trust | Access control, logging, change management evidence |

---

## Current-state assessment (verified against code)

Legend: ✅ have · 🟡 partial · ❌ missing · ➖ out of package scope (deployment/org)

### HIPAA §164.312 — Technical Safeguards

| Control | CFR | State | Evidence / gap |
|---|---|---|---|
| Unique user identification | (a)(2)(i) | ✅ | UUID PK on every user |
| **Emergency access procedure (break-glass)** | (a)(2)(ii) | ❌ | No break-glass role / emergency-access flow. **Required** for HMS (clinician must reach a patient record in an emergency, with heavy audit). |
| Automatic logoff | (a)(2)(iii) | ✅ | `session-manager.service.ts` enforces idle + absolute expiry (`isExpired`, `touchInterval`, sliding/`ttlSeconds`); comment explicitly cites HIPAA. **Verify defaults are conservative** (e.g. 15-min idle). |
| Encryption/decryption (at rest) | (a)(2)(iv) | ➖ | DB-level (TDE) / disk encryption is deployment's job. Package keeps `NestAuthUser` minimal (no PHI) — good design. |
| **Audit controls** | (b) | 🟡 | `AuditService` emits an audit-event **stream** to a `config.audit.onEvent` hook for **6 events** (LOGGED_IN, LOGGED_OUT, REGISTERED, PASSWORD_CHANGED, 2FA_ENABLED/DISABLED). **Gaps:** no FAILED-login event, no admin-action / impersonation / session-revoke / permission-change / API-key events; no built-in **persistent, tamper-evident, retained** audit store. |
| Person/entity authentication | (d) | ✅ | Argon2id password hashing (configurable cost) + MFA (TOTP/email-OTP/SMS-OTP/recovery/trusted-device). |
| Transmission security | (e) | 🟡 | Cookies set `httpOnly`, `sameSite`, `secure` (prod). TLS is deployment's job. **Gap:** secure-flag is prod-gated by `NODE_ENV` only; should be explicitly configurable + default-on for healthcare. |

### NIST SP 800-63B — Authentication (AAL2 target)

| Requirement | State | Gap |
|---|---|---|
| Salted, memory-hard password hash | ✅ | Argon2id |
| MFA available (AAL2) | ✅ | TOTP + OTP + recovery + trusted device |
| Min length ≥ 8, no composition mandates, no forced periodic rotation | 🟡 | `minLength` exists; confirm no forced rotation; **no breach-corpus check** |
| **Breached-password check** (block known-compromised) | ❌ | No HaveIBeenPwned/k-anonymity check |
| **Rate-limiting / throttling of auth attempts** | ❌ | Confirmed absent — no login/OTP/reset throttling |
| **Account lockout / failed-attempt handling** | ❌ | No lockout, no failed-attempt counter |
| Reauthentication at AAL2 (≤12h / ≤30m idle) | ✅ | Idle + absolute session timeout |
| Replay-resistant authenticator | ✅ | TOTP, single-use OTP/codes |

### Data protection (GDPR / India DPDP)

| Requirement | State | Gap |
|---|---|---|
| Data minimization | ✅ | `NestAuthUser` holds only auth fields; business/PHI fields live on consumer's `AppUser` (linked by `authUserId`) |
| **Consent capture + records** | ❌ | No consent model/events |
| **Right of access / data export** | 🟡 | User read exists; no one-call "export everything for this user" |
| **Right to erasure** (with audit) | 🟡 | Delete exists; need erasure-vs-anonymize policy + audit of the erasure |
| Records of processing / access logs | 🟡 | Tied to the audit gap above |
| Breach detection signals | ❌ | No failed-access / anomaly events to feed SIEM |

### Account & session hardening (cross-framework)

| Control | State |
|---|---|
| Session revocation on logout | ✅ (verified by test) |
| Logout-all / revoke all sessions | ✅ |
| **Concurrent-session limit per user** | ❌ |
| **Step-up / re-auth for sensitive actions** | ❌ (no `requireRecentAuth` guard) |
| **Failed-login lockout + alerting** | ❌ |
| API key secrets hashed at rest | ✅ (B-12 fix) |
| Account-enumeration resistance | ✅ (unknown-email login & forgot-password both return generic responses — verified by tests) |

---

## Gap list → severity → control to add

| # | Gap | Severity (for HMS) | Control / task |
|---|---|---|---|
| C-1 | **No rate-limiting / throttling** on login, OTP, reset, MFA | 🔴 P0 | Configurable throttle (per-IP + per-account), 429 on breach |
| C-2 | **No account lockout / failed-attempt handling** | 🔴 P0 | Failed-attempt counter, progressive lockout, admin unlock, lockout audit event |
| C-3 | **Audit trail incomplete + not persisted/immutable** | 🔴 P0 (HIPAA §164.312(b)) | Add FAILED_LOGIN + admin/impersonation/session-revoke/permission-change/api-key/account-locked events; ship an optional **append-only persistent audit store** (DB table, hash-chained for tamper-evidence) + retention guidance (HIPAA = 6 years) |
| C-4 | **No break-glass / emergency access** | 🔴 P0 (HIPAA §164.312(a)(2)(ii)) | `emergency-access` plugin: time-boxed elevated grant, mandatory reason, heavy audit + alert |
| C-5 | **No breached-password check** | 🟠 P1 (NIST) | Optional HaveIBeenPwned k-anonymity check on signup/change/reset |
| C-6 | **No step-up / recent-auth requirement** for sensitive ops | 🟠 P1 | `@RequireRecentAuth(maxAgeSeconds)` guard; forces re-auth before viewing/exporting PHI, changing security settings |
| C-7 | **No concurrent-session limit** | 🟠 P1 | Configurable max sessions/user; oldest evicted or new blocked |
| C-8 | **Consent capture + records** | 🟠 P1 (DPDP/GDPR) | `consent` plugin: record consent grant/withdraw with versioned purpose, events |
| C-9 | **Data export + erasure tooling** | 🟠 P1 (DPDP/GDPR) | `exportUserData(userId)` + `eraseUser(userId, { mode: 'delete'|'anonymize' })` with audit |
| C-10 | **Secure-cookie + TLS posture not explicit** | 🟡 P2 | `secure`/`sameSite` explicitly configurable, healthcare preset defaults them on; startup warning if off |
| C-11 | **Password-policy presets** | 🟡 P2 | Ship a `healthcare`/`nist-800-63b` password-policy preset |
| C-12 | **Compliance config preset + self-check** | 🟡 P2 | `compliance: 'hipaa'` preset that flips safe defaults (idle timeout, MFA-required, audit-persist, lockout) + a boot-time `complianceReport()` that lists which controls are active/inactive |
| C-13 | **ABDM / ABHA integration** (India) | 🟢 P3 | Optional `abdm` plugin (ABHA login + Consent Manager) — only if you join the national stack |

---

## Recommended: a `compliance` preset (the "standard package" ask)

The cleanest way to make this a **standard, compliance-ready package** without forcing every consumer into healthcare-grade strictness:

```ts
NestAuthModule.forRoot({
  compliance: 'hipaa',   // or 'nist-800-63b' | 'gdpr' | 'baseline'
  // The preset sets safe defaults that the consumer can still override:
  //   - session: { idleTimeout: '15m', absoluteTimeout: '12h', slidingExpiration: true }
  //   - mfa: { required: true }
  //   - lockout: { enabled: true, maxAttempts: 5, window: '15m', lockFor: '30m' }
  //   - rateLimit: { enabled: true }
  //   - password: { minLength: 12, breachCheck: true, forceRotation: false }
  //   - audit: { enabled: true, persist: true, immutable: true, retentionYears: 6 }
  //   - cookie: { secure: true, sameSite: 'strict' }
  //   - account-enumeration resistance: enforced
  ...
});
```

Plus a boot-time **`complianceReport()`** that prints which required controls are active and which are off (so an auditor/dev sees the posture at a glance, and CI can assert it).

---

## Test cases (added to `test-catalog.md` §L — Compliance)

Real tests, no mocks. Most map to the security suite (§F) but tightened for healthcare.

| TC | Test |
|---|---|
| TC-CMP-1 | Login throttled after N attempts in window → 429 (C-1) |
| TC-CMP-2 | Account locks after N failed logins; unlock via admin + lockout audit event (C-2) |
| TC-CMP-3 | OTP / reset endpoints throttled (C-1) |
| TC-CMP-4 | FAILED_LOGIN event emitted with actor/ip/reason (C-3) |
| TC-CMP-5 | Admin action (user CRUD, role change, impersonation, session-revoke) emits audit event (C-3) |
| TC-CMP-6 | Persistent audit store: append-only; rows are hash-chained / tamper-evident (C-3) |
| TC-CMP-7 | Break-glass grant is time-boxed, requires reason, emits high-severity audit + alert; auto-expires (C-4) |
| TC-CMP-8 | Breached password rejected on signup/change/reset (k-anonymity) (C-5) |
| TC-CMP-9 | `@RequireRecentAuth` blocks a sensitive route when last auth older than max age → 401/403 step-up (C-6) |
| TC-CMP-10 | Concurrent-session limit enforced (oldest evicted or new blocked) (C-7) |
| TC-CMP-11 | Consent grant/withdraw recorded with versioned purpose + events (C-8) |
| TC-CMP-12 | `exportUserData` returns the full auth footprint; `eraseUser` deletes/anonymizes + audits (C-9) |
| TC-CMP-13 | Idle timeout: session rejected after idle window; absolute timeout enforced (existing, tighten) |
| TC-CMP-14 | `compliance: 'hipaa'` preset flips the documented safe defaults (C-12) |
| TC-CMP-15 | `complianceReport()` lists active/inactive controls; CI asserts required-on (C-12) |
| TC-CMP-16 | Cookie `secure`+`sameSite=strict` under healthcare preset; startup warns if off (C-10) |

---

## Tasks (added to `task-tracker.md` Phase 11)

| ID | Task | Effort |
|---|---|---|
| CMP-1 | Rate-limiting (per-IP + per-account) on login/OTP/reset/MFA, configurable, 429 | M |
| CMP-2 | Account lockout: failed-attempt counter, progressive lock, admin unlock, audit | M |
| CMP-3 | Expand audit event coverage (FAILED_LOGIN, admin actions, impersonation, session-revoke, permission/role change, api-key, account-locked, break-glass) | S |
| CMP-4 | `audit-store` plugin: append-only, hash-chained (tamper-evident) persistent audit log + retention config | M |
| CMP-5 | `emergency-access` (break-glass) plugin: time-boxed elevated grant + reason + alert + auto-expire | M |
| CMP-6 | Breached-password check (HaveIBeenPwned k-anonymity), opt-in | S |
| CMP-7 | `@RequireRecentAuth(maxAge)` step-up guard + `recentAuthAt` in session | S |
| CMP-8 | Concurrent-session limit per user (config: evict-oldest / block-new) | S |
| CMP-9 | `consent` plugin: versioned consent capture + grant/withdraw events | M |
| CMP-10 | `exportUserData(userId)` + `eraseUser(userId, {mode})` with audit (DPDP/GDPR) | M |
| CMP-11 | Explicit `cookie.secure`/`sameSite` config + healthcare-preset defaults + startup warning | XS |
| CMP-12 | Password-policy presets (`nist-800-63b`, `healthcare`) | XS |
| CMP-13 | `compliance: 'hipaa' \| 'nist-800-63b' \| 'gdpr' \| 'baseline'` preset that flips safe defaults | M |
| CMP-14 | `complianceReport()` boot-time control inventory (active/inactive) + CI assertion helper | S |
| CMP-15 | Docs: HIPAA shared-responsibility matrix, BAA note, retention guidance, deployment checklist (TLS, DB-at-rest), HMS recipe | M |
| CMP-16 | `abdm`/`abha` plugin (India national health stack) — optional, P3 | L |

---

## What's already strong (don't rebuild)

- **Argon2id** password hashing — meets NIST verifier requirements
- **MFA** suite (TOTP/OTP/recovery/trusted-device) — enables AAL2 (now working post-B-13 fix)
- **Idle + absolute session timeout** with sliding expiration — HIPAA automatic-logoff
- **Account-enumeration resistance** — verified by tests
- **Minimal `NestAuthUser`** — data-minimization by design; PHI never sits in the auth tables
- **Session revocation** (single + all) — verified
- **API-key secrets hashed at rest** (B-12) — timing-safe verify
- **RBAC with guard namespaces** — least-privilege foundation
- **Audit event stream + `onEvent` hook** — the spine to build the persistent store on

---

## Honest bottom line for the HMS decision

The package gives you a **solid AAL2-capable authentication core** with several HIPAA-aware pieces already in place (automatic logoff, MFA, argon2, enumeration resistance, data minimization, session revocation). It is **not yet turnkey-compliant** — the **P0 gaps are rate-limiting, account lockout, a complete + persistent + tamper-evident audit trail, and break-glass emergency access**. Close C-1..C-4 (Phase 11 CMP-1..CMP-5) and ship the `compliance: 'hipaa'` preset + `complianceReport()`, and the package becomes a defensible technical-safeguards foundation for an HMS — with the explicit understanding that org policies, BAAs, TLS, DB-at-rest encryption, and PHI-access logging in *your* app complete the compliance picture.

---

## Related

- [`task-tracker.md`](task-tracker.md) — Phase 11 (CMP-*) + existing security Phase 8 (T-179..T-190)
- [`test-catalog.md`](test-catalog.md) — §F Security, §L Compliance
- [`000-master-roadmap.md`](000-master-roadmap.md) §3 — plugin architecture (audit-store, emergency-access, consent, abdm are all plugins)

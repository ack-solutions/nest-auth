import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { AuthConfigService } from '../core/services/auth-config.service';
import { ERROR_CODES } from '../auth.constants';
import { COMMON_PASSWORDS } from './common-passwords';

export interface PasswordPolicyContext {
    /** The account's email — used for the contains-identifier check. */
    email?: string;
}

function reject(message: string, code: string): never {
    throw new BadRequestException({ message, code });
}

/**
 * Enforce `password.policy` on a plaintext password. A no-op unless
 * `password.policy.enabled`. Called from the entity `setPassword` choke points so
 * every path (signup, change, reset, admin-set) is covered uniformly. Throws a
 * `BadRequestException` (→ HTTP 400) with a specific code on failure.
 */
export async function assertPasswordPolicy(password: string, ctx: PasswordPolicyContext = {}): Promise<void> {
    const policy = AuthConfigService.getOptions().password?.policy;
    if (!policy?.enabled) return;

    if (typeof password !== 'string' || password.length === 0) {
        reject('Password is required', ERROR_CODES.PASSWORD_TOO_SHORT);
    }

    const minLength = policy.minLength ?? 8;
    const maxLength = policy.maxLength ?? 128;
    if (password.length < minLength) {
        reject(`Password must be at least ${minLength} characters`, ERROR_CODES.PASSWORD_TOO_SHORT);
    }
    if (password.length > maxLength) {
        reject(`Password must be at most ${maxLength} characters`, ERROR_CODES.PASSWORD_TOO_LONG);
    }

    const lower = password.toLowerCase();

    // Common / blocklisted passwords (exact match, case-insensitive).
    if (policy.blockCommonPasswords !== false && COMMON_PASSWORDS.has(lower)) {
        reject('This password is too common', ERROR_CODES.PASSWORD_TOO_COMMON);
    }
    if (Array.isArray(policy.blocklist) && policy.blocklist.some((p) => typeof p === 'string' && p.toLowerCase() === lower)) {
        reject('This password is not allowed', ERROR_CODES.PASSWORD_TOO_COMMON);
    }

    // Password must not contain the email local-part (e.g. ada@x.com → "ada1234").
    if (policy.blockContainsIdentifier !== false && ctx.email) {
        const local = ctx.email.split('@')[0]?.toLowerCase();
        if (local && local.length >= 3 && lower.includes(local)) {
            reject('Password must not contain your email address', ERROR_CODES.PASSWORD_CONTAINS_IDENTIFIER);
        }
    }

    // Breached-password check via HIBP (k-anonymity — only a 5-char hash prefix
    // ever leaves the process). Fail-open by default: an HIBP outage must not
    // block password changes.
    if (policy.checkBreached && (await isPasswordBreached(password, policy.hibp))) {
        reject('This password has appeared in a known data breach — please choose a different one', ERROR_CODES.PASSWORD_BREACHED);
    }
}

export interface HibpOptions {
    /** Range API base URL. Default HIBP; override for an enterprise proxy or tests. */
    baseUrl?: string;
    /** Request timeout in ms. Default 2000. */
    timeoutMs?: number;
    /** On HIBP error/timeout, allow the password (true, default) or treat it as breached (false). */
    failOpen?: boolean;
}

/**
 * Check a password against Have I Been Pwned using k-anonymity: SHA-1 the
 * password, send only the first 5 hex chars of the hash, and match the remaining
 * 35 chars locally against the returned suffixes. The password (and its full
 * hash) never leave the process. `Add-Padding` obscures the queried prefix.
 */
export async function isPasswordBreached(password: string, hibp?: HibpOptions): Promise<boolean> {
    const baseUrl = (hibp?.baseUrl || 'https://api.pwnedpasswords.com/range').replace(/\/$/, '');
    const timeoutMs = hibp?.timeoutMs ?? 2000;
    const failOpen = hibp?.failOpen !== false;

    try {
        const sha1 = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
        const prefix = sha1.slice(0, 5);
        const suffix = sha1.slice(5);

        const res = await fetch(`${baseUrl}/${prefix}`, {
            headers: { 'Add-Padding': 'true' },
            signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) return !failOpen; // fail-open → allow; fail-closed → treat as breached

        const body = await res.text();
        for (const line of body.split('\n')) {
            const idx = line.indexOf(':');
            if (idx === -1) continue;
            const suf = line.slice(0, idx).trim().toUpperCase();
            if (suf === suffix) {
                const count = parseInt(line.slice(idx + 1).trim(), 10);
                return Number.isFinite(count) && count > 0; // padded rows carry count 0
            }
        }
        return false;
    } catch {
        return !failOpen; // network error / timeout
    }
}

import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import ms from 'ms';
import { AuthConfigService } from './auth-config.service';
import { NestAuthEvents, ERROR_CODES } from '../../auth.constants';
import { LoginFailedEvent } from '../../auth/events/login-failed.event';
import { UserLoggedInEvent } from '../../auth/events/user-logged-in.event';

interface LockState {
    failures: number;
    windowResetAt: number;
    lockedUntil: number;
}

/**
 * Soft account lockout. Bookkeeping is event-driven (no changes to the login
 * flow): it counts credential-mismatch failures off `LOGIN_FAILED` and clears
 * them off `LOGGED_IN`. The pre-check that rejects a locked account is done by
 * `LockoutGuard` on the login route. Keyed by identifier + IP so a failing
 * attacker can't lock a victim's logins from other IPs (avoids lockout-DoS).
 * In-memory (per-instance) — for multi-instance, front it with sticky sessions
 * or a shared store (future).
 */
@Injectable()
export class LockoutService {
    private readonly store = new Map<string, LockState>();
    private sweepCounter = 0;

    private cfg() {
        return AuthConfigService.getOptions().security?.lockout;
    }

    isEnabled(): boolean {
        return this.cfg()?.enabled === true;
    }

    private toMs(v: number | string | undefined, fallback: string): number {
        if (typeof v === 'number' && v > 0) return v;
        if (typeof v === 'string') {
            const n = ms(v);
            if (typeof n === 'number' && n > 0) return n;
        }
        return ms(fallback) as number;
    }

    private windowMs(): number { return this.toMs(this.cfg()?.window, '15m'); }
    private lockMs(): number { return this.toMs(this.cfg()?.lockDuration, '15m'); }
    private maxFailures(): number {
        const m = this.cfg()?.maxFailedAttempts;
        return m && m > 0 ? m : 10;
    }

    private key(identifier: string, ip?: string): string {
        return `${identifier.trim().toLowerCase()}:${ip ?? '-'}`;
    }

    /** Is this identifier+IP currently locked? */
    check(identifier: string | undefined, ip?: string): { locked: boolean; retryAfter: number } {
        if (!this.isEnabled() || !identifier) return { locked: false, retryAfter: 0 };
        const s = this.store.get(this.key(identifier, ip));
        const now = Date.now();
        if (s && s.lockedUntil > now) {
            return { locked: true, retryAfter: Math.max(1, Math.ceil((s.lockedUntil - now) / 1000)) };
        }
        return { locked: false, retryAfter: 0 };
    }

    @OnEvent(NestAuthEvents.LOGIN_FAILED)
    onLoginFailed(event: LoginFailedEvent): void {
        if (!this.isEnabled()) return;
        const p = event?.payload;
        // Count only credential mismatches — not "missing field" / "invalid provider" noise.
        if (!p?.identifier || p.reasonCode !== ERROR_CODES.INVALID_CREDENTIALS) return;
        this.recordFailure(p.identifier, p.ip);
    }

    @OnEvent(NestAuthEvents.LOGGED_IN)
    onLoggedIn(event: UserLoggedInEvent): void {
        if (!this.isEnabled()) return;
        const user = event?.payload?.user;
        if (user?.email) this.resetForIdentifier(user.email);
        if (user?.phone) this.resetForIdentifier(user.phone);
    }

    private recordFailure(identifier: string, ip?: string): void {
        const now = Date.now();
        const key = this.key(identifier, ip);
        let s = this.store.get(key);
        if (!s || s.windowResetAt <= now) {
            s = { failures: 0, windowResetAt: now + this.windowMs(), lockedUntil: 0 };
        }
        s.failures += 1;
        if (s.failures >= this.maxFailures()) {
            s.lockedUntil = now + this.lockMs();
            s.failures = 0;
            s.windowResetAt = now + this.windowMs();
        }
        this.store.set(key, s);
        this.maybeSweep(now);
    }

    /**
     * Clear lock state for an identifier across every IP. Public so non-event
     * login flows (e.g. the admin console) can reset the counter on success.
     */
    clearIdentifier(identifier: string): void {
        this.resetForIdentifier(identifier);
    }

    /** Clear lock state for an identifier across every IP (on successful login). */
    private resetForIdentifier(identifier: string): void {
        const prefix = `${identifier.trim().toLowerCase()}:`;
        for (const k of this.store.keys()) {
            if (k.startsWith(prefix)) this.store.delete(k);
        }
    }

    private maybeSweep(now: number): void {
        if (++this.sweepCounter % 512 !== 0) return;
        for (const [k, v] of this.store) {
            if (v.lockedUntil <= now && v.windowResetAt <= now) this.store.delete(k);
        }
    }
}

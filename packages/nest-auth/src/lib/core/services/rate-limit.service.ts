import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthConfigService } from './auth-config.service';
import {
    IRateLimitStore,
    RateLimitBucket,
    RateLimitBucketConfig,
    RateLimitBucketName,
    RateLimitHit,
} from '../interfaces/rate-limit.interface';
import { ERROR_CODES } from '../../auth.constants';

/** Built-in per-bucket defaults (overridable via security.rateLimit.buckets). */
export const DEFAULT_RATE_LIMIT_BUCKETS: Record<RateLimitBucket, RateLimitBucketConfig> = {
    login: { windowMs: 60_000, max: 5 },
    signup: { windowMs: 60_000, max: 5 },
    forgotPassword: { windowMs: 60_000, max: 3 },
    verifyOtp: { windowMs: 60_000, max: 5 },
    passwordlessSend: { windowMs: 60_000, max: 3 },
    mfaVerify: { windowMs: 60_000, max: 5 },
    adminLogin: { windowMs: 60_000, max: 5 },
    // Secret-key-gated admin bootstrap/recovery: strict, since a hit is a
    // credential-forging primitive. 5 attempts per 15 minutes.
    adminReset: { windowMs: 15 * 60_000, max: 5 },
};

/**
 * In-memory sliding-window counter. Per-process (fine for a single instance or
 * dev); use a shared store for multi-instance deployments. Expired windows are
 * reclaimed lazily on access and by an opportunistic sweep.
 */
export class MemoryRateLimitStore implements IRateLimitStore {
    private readonly map = new Map<string, RateLimitHit>();
    private sweepCounter = 0;

    increment(key: string, windowMs: number): RateLimitHit {
        const now = Date.now();
        const existing = this.map.get(key);
        if (!existing || existing.resetAt <= now) {
            const hit: RateLimitHit = { count: 1, resetAt: now + windowMs };
            this.map.set(key, hit);
            this.maybeSweep(now);
            return hit;
        }
        existing.count += 1;
        return existing;
    }

    private maybeSweep(now: number): void {
        // Cheap amortized cleanup so the map doesn't grow unbounded with keys
        // whose windows have long expired.
        if (++this.sweepCounter % 512 !== 0) return;
        for (const [k, v] of this.map) {
            if (v.resetAt <= now) this.map.delete(k);
        }
    }
}

@Injectable()
export class RateLimitService {
    private readonly memoryStore = new MemoryRateLimitStore();

    private cfg() {
        return AuthConfigService.getOptions().security?.rateLimit;
    }

    isEnabled(): boolean {
        return this.cfg()?.enabled === true;
    }

    private store(): IRateLimitStore {
        return this.cfg()?.store ?? this.memoryStore;
    }

    /**
     * Resolve a bucket's window/max: a built-in default with any override merged
     * over it, or an app-defined bucket from `security.rateLimit.buckets`.
     * Returns `null` for a name that is neither (or an app-defined one missing
     * `windowMs`/`max`) — see {@link assertBucketsDefined}.
     */
    resolveBucket(bucket: RateLimitBucketName): RateLimitBucketConfig | null {
        const builtIn = Object.prototype.hasOwnProperty.call(DEFAULT_RATE_LIMIT_BUCKETS, bucket)
            ? DEFAULT_RATE_LIMIT_BUCKETS[bucket as RateLimitBucket]
            : undefined;
        const override = this.cfg()?.buckets?.[bucket];
        const merged = { ...builtIn, ...override };
        if (typeof merged.windowMs !== 'number' || typeof merged.max !== 'number') return null;
        return merged as RateLimitBucketConfig;
    }

    /**
     * Throw if any of `buckets` is neither built-in nor declared in config. Run
     * at boot over every `@RateLimit(...)` name, so a typo or a missing config
     * entry fails startup instead of leaving the route unthrottled.
     */
    assertBucketsDefined(buckets: Iterable<RateLimitBucketName>): void {
        const missing = [...new Set(buckets)].filter((b) => !this.resolveBucket(b));
        if (missing.length === 0) return;
        throw new Error(
            `[NestAuth] @RateLimit names undefined bucket(s): ${missing.map((b) => `'${b}'`).join(', ')}. ` +
            'Declare each in security.rateLimit.buckets with { windowMs, max }, ' +
            `or use a built-in bucket (${Object.keys(DEFAULT_RATE_LIMIT_BUCKETS).join(', ')}).`,
        );
    }

    private bucketConfig(bucket: RateLimitBucketName): RateLimitBucketConfig {
        const config = this.resolveBucket(bucket);
        // Fail closed: an undefined bucket used to resolve to `{}` and skip the
        // limit silently. Boot validation catches decorator names; this covers
        // direct `enforce()` calls with a dynamic name.
        if (!config) {
            throw new Error(
                `[NestAuth] Rate-limit bucket '${bucket}' is not defined. ` +
                'Declare it in security.rateLimit.buckets with { windowMs, max }.',
            );
        }
        return config;
    }

    /**
     * Enforce the limit for `bucket` on this request. No-op when disabled. Sets a
     * `Retry-After` header and throws 429 when the limit is exceeded.
     */
    async enforce(bucket: RateLimitBucketName, req: Request, res?: Response): Promise<void> {
        return this.enforceBucket(bucket, req, res, false);
    }

    /**
     * Like {@link enforce} but ALWAYS runs, regardless of `security.rateLimit.enabled`.
     * Used by the admin console to give its highest-value endpoints (login /
     * secret-key signup+reset) brute-force protection by default. Consumers can
     * still tune the window/max via `security.rateLimit.buckets` or disable it via
     * `adminConsole.bruteForce.enabled: false`.
     */
    async enforceAlways(bucket: RateLimitBucketName, req: Request, res?: Response): Promise<void> {
        return this.enforceBucket(bucket, req, res, true);
    }

    private async enforceBucket(bucket: RateLimitBucketName, req: Request, res: Response | undefined, force: boolean): Promise<void> {
        if (!force && !this.isEnabled()) return;

        const { windowMs, max } = this.bucketConfig(bucket);
        if (!Number.isFinite(max) || max <= 0) return; // a non-positive max disables the bucket

        const keyBy = this.cfg()?.keyBy ?? 'both';
        const ip = this.clientIp(req);
        const identifier = this.identifier(req);

        const keys: string[] = [];
        if (keyBy === 'ip' || keyBy === 'both') keys.push(`${bucket}:ip:${ip}`);
        if ((keyBy === 'identifier' || keyBy === 'both') && identifier) keys.push(`${bucket}:id:${identifier}`);
        if (keys.length === 0) keys.push(`${bucket}:ip:${ip}`); // always have at least the IP key

        for (const key of keys) {
            const hit = await this.store().increment(key, windowMs);
            if (hit.count > max) {
                const retryAfter = Math.max(1, Math.ceil((hit.resetAt - Date.now()) / 1000));
                if (res && typeof res.setHeader === 'function') {
                    res.setHeader('Retry-After', String(retryAfter));
                }
                throw new HttpException(
                    {
                        message: 'Too many requests. Please try again later.',
                        code: ERROR_CODES.RATE_LIMITED,
                        retryAfter,
                    },
                    HttpStatus.TOO_MANY_REQUESTS,
                );
            }
        }
    }

    private clientIp(req: Request): string {
        return (req.ip || (req.socket && req.socket.remoteAddress) || 'unknown') as string;
    }

    /** Best-effort target identifier (account) from the raw request body. */
    private identifier(req: Request): string | undefined {
        const b: any = (req as any).body ?? {};
        const raw =
            b.credentials?.email ??
            b.credentials?.phone ??
            b.email ??
            b.phone ??
            b.identifier;
        return typeof raw === 'string' && raw.trim() ? raw.trim().toLowerCase() : undefined;
    }
}

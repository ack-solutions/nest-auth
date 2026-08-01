import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { In, Repository } from 'typeorm';
import { NestAuthBlockedEmailDomain } from '../entities/blocked-email-domain.entity';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { NestAuthEvents, ERROR_CODES } from '../../auth.constants';
import { DEFAULT_DISPOSABLE_DOMAINS } from '../data/disposable-domains.generated';

export interface BlockedDomainListResult {
    data: NestAuthBlockedEmailDomain[];
    total: number;
    page: number;
    pageSize: number;
}

/**
 * Disposable / blocked email-domain screening. The blocklist lives in the DB
 * (managed from the admin console, seedable from the built-in ~8k list). Sign-ups
 * whose email domain is blocked are rejected when `emailAuth.disposable` is on.
 */
@Injectable()
export class DisposableEmailService {
    constructor(
        @InjectRepository(NestAuthBlockedEmailDomain)
        private readonly repo: Repository<NestAuthBlockedEmailDomain>,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    private cfg() {
        return AuthConfigService.getOptions().emailAuth?.disposable;
    }

    isEnabled(): boolean {
        return this.cfg()?.enabled === true;
    }

    /** How many domains the built-in default list contains (for the admin UI). */
    get defaultCount(): number {
        return DEFAULT_DISPOSABLE_DOMAINS.length;
    }

    private domainOfEmail(email?: string): string | undefined {
        if (!email || typeof email !== 'string') return undefined;
        const at = email.lastIndexOf('@');
        if (at < 0) return undefined;
        const d = email.slice(at + 1).trim().toLowerCase();
        return d || undefined;
    }

    private normalizeDomain(input: string): string {
        return String(input).trim().toLowerCase().replace(/^@+/, '');
    }

    /** Is this email's domain on the blocklist (respecting the config allowlist)? */
    async isBlocked(email?: string): Promise<boolean> {
        const domain = this.domainOfEmail(email);
        if (!domain) return false;
        const allow = this.cfg()?.allowlist;
        if (Array.isArray(allow) && allow.some((a) => this.normalizeDomain(a) === domain)) return false;
        const found = await this.repo.findOne({ where: { domain } });
        return !!found;
    }

    /**
     * Enforce at sign-up. No-op unless enabled. In `block` mode (default) throws
     * 403; in `flag` mode allows the sign-up but emits an event for monitoring.
     */
    async assertAllowed(email?: string): Promise<void> {
        if (!this.isEnabled()) return;
        if (!(await this.isBlocked(email))) return;

        if ((this.cfg()?.mode ?? 'block') === 'flag') {
            await this.eventEmitter
                .emitAsync(NestAuthEvents.DISPOSABLE_EMAIL_DETECTED, { email, domain: this.domainOfEmail(email) })
                .catch(() => undefined);
            return;
        }
        throw new ForbiddenException({
            message: 'This email domain is not allowed for sign-up',
            code: ERROR_CODES.EMAIL_DOMAIN_NOT_ALLOWED,
        });
    }

    // ------------------------------------------------------------------ admin API

    async list(opts: { search?: string; page?: number; pageSize?: number } = {}): Promise<BlockedDomainListResult> {
        const page = Math.max(1, Number(opts.page) || 1);
        const pageSize = Math.min(200, Math.max(1, Number(opts.pageSize) || 50));

        const qb = this.repo.createQueryBuilder('d').orderBy('d.domain', 'ASC');
        // Strip LIKE wildcards from the admin's search term (they'd act as globs).
        const search = String(opts.search ?? '').trim().toLowerCase().replace(/[%_]/g, '');
        if (search) qb.where('d.domain LIKE :q', { q: `%${search}%` });

        qb.skip((page - 1) * pageSize).take(pageSize);
        const [data, total] = await qb.getManyAndCount();
        return { data, total, page, pageSize };
    }

    count(): Promise<number> {
        return this.repo.count();
    }

    /** Add one or more domains. Existing domains are skipped (idempotent). */
    async addDomains(domains: string[]): Promise<{ added: number; skipped: number }> {
        const clean = [...new Set((domains || []).map((d) => this.normalizeDomain(d)).filter(Boolean))];
        if (!clean.length) return { added: 0, skipped: 0 };

        const before = await this.repo.count({ where: { domain: In(clean) } });
        await this.repo
            .createQueryBuilder()
            .insert()
            .into(NestAuthBlockedEmailDomain)
            .values(clean.map((domain) => ({ domain, source: 'manual' })))
            .orIgnore()
            .execute();
        const after = await this.repo.count({ where: { domain: In(clean) } });
        const added = after - before;
        return { added, skipped: clean.length - added };
    }

    async removeDomain(idOrDomain: string): Promise<void> {
        // Accept either the row id (UUID) or the domain string.
        const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrDomain);
        if (looksLikeUuid) {
            await this.repo.delete({ id: idOrDomain });
        } else {
            await this.repo.delete({ domain: this.normalizeDomain(idOrDomain) });
        }
    }

    /** Import the built-in ~8k default list into the DB, skipping existing rows. */
    async importDefaults(): Promise<{ imported: number; total: number }> {
        const before = await this.repo.count();
        const batchSize = 500;
        for (let i = 0; i < DEFAULT_DISPOSABLE_DOMAINS.length; i += batchSize) {
            const batch = DEFAULT_DISPOSABLE_DOMAINS.slice(i, i + batchSize).map((domain) => ({ domain, source: 'default' }));
            await this.repo
                .createQueryBuilder()
                .insert()
                .into(NestAuthBlockedEmailDomain)
                .values(batch)
                .orIgnore()
                .execute();
        }
        const total = await this.repo.count();
        return { imported: total - before, total };
    }
}

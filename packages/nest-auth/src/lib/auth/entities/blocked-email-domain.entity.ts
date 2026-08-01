import { BaseEntity, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A disposable / blocked email domain. Sign-ups whose email domain matches a row
 * here are rejected (when `emailAuth.disposable` is enabled). Managed from the
 * admin console; seedable from the built-in ~8k list.
 */
@Entity('nest_auth_blocked_email_domains')
export class NestAuthBlockedEmailDomain extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index({ unique: true })
    @Column()
    domain: string;

    /** 'manual' (added in the dashboard) or 'default' (imported from the built-in list). */
    @Column({ default: 'manual' })
    source: string;

    @CreateDateColumn()
    createdAt: Date;
}

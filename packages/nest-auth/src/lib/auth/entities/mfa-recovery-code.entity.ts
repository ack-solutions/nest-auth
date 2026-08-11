import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { NestAuthUser } from '../../user/entities/user.entity';

/**
 * A single MFA recovery (backup) code. Each code is one row; only the HMAC hash
 * of the code is stored — the plaintext is shown once at generation and never
 * persisted. A code is single-use: `usedAt` is stamped when it's redeemed.
 *
 * This replaces the legacy single `NestAuthUser.mfaRecoveryCode` column (which is
 * still honoured for backward compatibility), so an account can hold a set of
 * codes (GitHub issues 16, Google 10) instead of one single point of failure.
 */
@Entity('nest_auth_mfa_recovery_codes')
export class NestAuthMfaRecoveryCode {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column()
    userId: string;

    @ManyToOne(() => NestAuthUser, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: NestAuthUser;

    /** HMAC-SHA256(secret, plaintext) as hex. */
    @Column()
    codeHash: string;

    /** Set when the code is redeemed (single-use). null/absent = still valid. */
    @Column({ nullable: true })
    usedAt?: Date;

    @CreateDateColumn()
    createdAt: Date;
}

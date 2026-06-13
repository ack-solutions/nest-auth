import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { NestAuthUser } from '../../user/entities/user.entity';
import { hmacSha256Hex, timingSafeEqualHex } from '../../utils/has-token';

@Entity('nest_auth_trusted_devices')
export class NestAuthTrustedDevice {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    @Index()
    userId: string;

    @ManyToOne(() => NestAuthUser, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: NestAuthUser;

    @Column({ type: 'text' , select: false})
    tokenHash: string;

    @Column({ nullable: true })
    userAgent: string;

    @Column({ nullable: true })
    ipAddress: string;

    @Column()
    expiresAt: Date;

    // Typed `Date` (NOT `Date | null`) on purpose: a union makes
    // emitDecoratorMetadata produce `Object`, which forces an explicit column
    // type — and there is NO datetime literal that every driver accepts
    // (`datetime` is rejected by Postgres, `timestamp` by SQLite). Keeping the
    // property a plain `Date` lets TypeORM infer the correct per-driver type
    // (timestamp on Postgres, datetime on MySQL/SQLite). At runtime the column
    // is NULL until the device is revoked.
    @Column({ nullable: true })
    revokedAt: Date;

    @Column({ nullable: true })
    lastUsedAt: Date;

    @CreateDateColumn()
    createdAt: Date;

    async setTrustToken(secret: string, plainToken: string): Promise<void> {
        this.tokenHash = hmacSha256Hex(secret, plainToken);
    }

    async validateTrustToken(secret: string, plainToken: string): Promise<boolean> {
        if (!plainToken || !this.tokenHash) return false;
        const computed = hmacSha256Hex(secret, plainToken);
        return timingSafeEqualHex(this.tokenHash, computed);
    }
}

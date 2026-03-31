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

    @Column({ nullable: true })
    revokedAt: Date | null;

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

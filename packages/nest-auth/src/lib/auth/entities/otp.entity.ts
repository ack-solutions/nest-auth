import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, UpdateDateColumn } from 'typeorm';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthOTPTypeEnum } from '@ackplus/nest-auth-contracts';
import { BaseEntity } from 'typeorm';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { hmacSha256Hex, timingSafeEqualHex } from '../../utils/has-token';

@Entity('nest_auth_otps')
export class NestAuthOTP extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @Column({ select: false })
    code: string;

    @Column({ type: 'text' })
    type: NestAuthOTPTypeEnum;

    @Column()
    expiresAt: Date;

    /**
     * Failed verification attempts against this code. Incremented on each wrong
     * guess; once it reaches `otp.maxAttempts` the code is invalidated so a short
     * numeric code can't be brute-forced within its TTL.
     */
    @Column({ default: 0 })
    attempts: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => NestAuthUser, user => user.otps, { onDelete: 'CASCADE' })
    user?: NestAuthUser;

    private getOtpSecret(): string {
        const opts = AuthConfigService.getOptions();
        const secret = opts.otp?.secret || opts.session?.jwt?.secret;
        if (!secret) {
            throw new Error('OTP HMAC secret is not configured. Set otp.secret or session.jwt.secret.');
        }
        return secret;
    }

    async validateCode(code: string): Promise<boolean> {
        let hashedCode: string;
        if (!this.code) {
            const otp = await NestAuthOTP.findOne({ where: { id: this.id }, select: ['code'] });
            if (!otp || !otp.code) {
                return false;
            }
            hashedCode = otp.code;
        } else {
            hashedCode = this.code;
        }

        const computed = hmacSha256Hex(this.getOtpSecret(), code);
        return timingSafeEqualHex(hashedCode, computed);
    }

    async setCode(code: string): Promise<void> {
        this.code = hmacSha256Hex(this.getOtpSecret(), code);
    }
}

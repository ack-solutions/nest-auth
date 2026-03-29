import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, UpdateDateColumn } from 'typeorm';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthOTPTypeEnum } from '@ackplus/nest-auth-contracts';
import { BaseEntity } from 'typeorm';
import { hash, verify, Algorithm } from '@node-rs/argon2';

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

    @Column({ default: false })
    used: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => NestAuthUser, user => user.otps, { onDelete: 'CASCADE' })
    user: NestAuthUser;

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

        return await verify(hashedCode, code);
    }

    async setCode(code: string): Promise<void> {
        // Argon2id is the recommended variant (hybrid of Argon2i and Argon2d)
        const hashedCode = await hash(code, {
            algorithm: Algorithm.Argon2id,
            memoryCost: 65536, // 64 MiB
            timeCost: 3,       // 3 iterations
            parallelism: 4     // 4 parallel threads
        });

        await NestAuthOTP.update({ id: this.id }, { code: hashedCode });
        this.code = hashedCode;
    }
}

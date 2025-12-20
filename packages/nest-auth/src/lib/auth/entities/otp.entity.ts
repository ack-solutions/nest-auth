import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, UpdateDateColumn } from 'typeorm';
import { NestAuthUser } from '../../user/entities/user.entity';
import { OTPTypeEnum } from '../../core/interfaces/otp.interface';

@Entity('nest_auth_otps')
export class NestAuthOTP {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @Column()
    code: string;

    @Column({ type: 'text' })
    type: OTPTypeEnum;

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
}

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { NestAuthUser } from '../../user/entities/user.entity';

@Entity('nest_auth_mfa_secrets')
export class NestAuthMFASecret {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @ManyToOne(() => NestAuthUser, user => user.mfaSecrets, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: NestAuthUser;

    @Column()
    secret: string;

    @Column({ default: false })
    verified: boolean;

    @Column({ nullable: true })
    deviceName: string;

    @Column({ nullable: true })
    lastUsedAt: Date;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}

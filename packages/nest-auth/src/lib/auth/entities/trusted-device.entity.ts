import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { NestAuthUser } from '../../user/entities/user.entity';

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

    @Column()
    @Index()
    token: string;

    @Column({ nullable: true })
    userAgent: string;

    @Column({ nullable: true })
    ipAddress: string;

    @Column()
    expiresAt: Date;

    @Column({ nullable: true })
    lastUsedAt: Date;

    @CreateDateColumn()
    createdAt: Date;
}

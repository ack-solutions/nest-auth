import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    BaseEntity,
    RelationId
} from 'typeorm';
import { NestAuthUser } from '../../user/entities/user.entity';


@Entity('nest_auth_sessions')
export class NestAuthSession extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ nullable: true })
    @RelationId((session: NestAuthSession) => session.user)
    userId: string;

    @ManyToOne(() => NestAuthUser, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: NestAuthUser;

    @Column('simple-json', { nullable: true, default: '{}' })
    data?: any;

    @Column({ nullable: true })
    refreshToken: string;

    @Column({ nullable: true })
    expiresAt: Date;

    @Column({ nullable: true })
    userAgent?: string;

    @Column({ nullable: true })
    deviceName?: string;

    @Column({ nullable: true })
    ipAddress?: string;

    @Column({ nullable: true })
    lastActive: Date;

    @CreateDateColumn()
    createdAt?: Date;

    @UpdateDateColumn()
    updatedAt?: Date;
}

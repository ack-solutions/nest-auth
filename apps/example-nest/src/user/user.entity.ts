import { BaseEntity, Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index, PrimaryGeneratedColumn } from 'typeorm';
import { NestAuthUser } from '@ackplus/nest-auth';

/**
 * App-specific user details for this example project.
 * We keep this separate from `NestAuthUser.metadata` to make the use-case explicit.
 */
@Entity('app_users')
export class AppUser extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index({ unique: true })
    @Column({ type: 'uuid' })
    authUserId: string;

    @Column({ type: 'varchar', nullable: true })
    firstName?: string;

    @Column({ type: 'varchar', nullable: true })
    lastName?: string;

    @Column({ type: 'varchar', nullable: true })
    gender?: string;

    @Column({ type: 'date', nullable: true })
    dob?: Date | null;

    @ManyToOne(() => NestAuthUser, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'authUserId' })
    authUser: NestAuthUser;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}


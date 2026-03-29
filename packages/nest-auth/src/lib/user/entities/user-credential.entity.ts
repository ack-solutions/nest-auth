import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    BaseEntity,
    RelationId,
    JoinColumn,
    Index,
} from 'typeorm';
import { NestAuthUser } from './user.entity';
import { NestAuthIdentity } from './identity.entity';

/** Stored credential kinds (password hash, TOTP secret, recovery codes, etc.). */
export type NestAuthUserCredentialType = 'password' | 'totp' | 'recovery_code';

@Entity('nest_auth_user_credentials')
@Index(['userId'])
export class NestAuthUserCredential extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    @RelationId((c: NestAuthUserCredential) => c.user)
    userId: string;

    @ManyToOne(() => NestAuthUser, (user) => user.userCredentials, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: NestAuthUser;

    @ManyToOne(() => NestAuthIdentity, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'identityId' })
    identity?: NestAuthIdentity | null;

    /** Foreign key to `identity`; mirrors `identityId` column when relation is not loaded. */
    @RelationId((c: NestAuthUserCredential) => c.identity)
    identityId?: string | null;

    @Column({ type: 'varchar', length: 32 })
    type: NestAuthUserCredentialType;

    @Column({ nullable: true })
    secretHash?: string;

    @Column({ type: 'simple-json', nullable: true, default: '{}' })
    metadata?: Record<string, any>;

    @Column({ default: true })
    enabled: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}

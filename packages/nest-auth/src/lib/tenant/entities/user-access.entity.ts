import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    RelationId,
    Unique,
    Index,
    ManyToMany,
    JoinTable,
    BaseEntity,
} from 'typeorm';
import { NestAuthTenant } from './tenant.entity';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthRole } from '../../role/entities/role.entity';

@Entity('nest_auth_user_accesses')
@Unique(['userId', 'tenantId'])
export class NestAuthUserAccess extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ nullable: true })
    @Index()
    @RelationId((access: NestAuthUserAccess) => access.user)
    userId: string;

    @Column({ nullable: true })
    @Index()
    @RelationId((access: NestAuthUserAccess) => access.tenant)
    tenantId: string;

    @ManyToOne(() => NestAuthUser, { onDelete: 'CASCADE' })
    user: NestAuthUser;

    @ManyToOne(() => NestAuthTenant, { onDelete: 'CASCADE' })
    tenant: NestAuthTenant;

    /** Multiple roles for this user access (tenant-specific). */
    @ManyToMany(() => NestAuthRole, role => role.userAccesses, { onDelete: 'CASCADE' })
    @JoinTable({
        name: 'nest_auth_user_access_roles',
        joinColumn: { name: 'nestAuthUserAccessId', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'nestAuthRolesId', referencedColumnName: 'id' },
    })
    roles: NestAuthRole[];

    @Column({ default: true })
    isActive: boolean;

    @Column({ default: false })
    isDefault: boolean;

    @Column({ default: 'active' })
    status: string;

    @Column({ type: 'simple-json', nullable: true, default: '{}' })
    metadata?: Record<string, any>;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}

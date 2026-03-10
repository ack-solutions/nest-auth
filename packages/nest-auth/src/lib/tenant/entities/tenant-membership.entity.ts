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

@Entity('nest_auth_tenant_memberships')
@Unique(['userId', 'tenantId'])
export class NestAuthTenantMembership extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ nullable: true })
    @Index()
    @RelationId((membership: NestAuthTenantMembership) => membership.user)
    userId: string;

    @Column({ nullable: true })
    @Index()
    @RelationId((membership: NestAuthTenantMembership) => membership.tenant)
    tenantId: string;

    @ManyToOne(() => NestAuthUser, { onDelete: 'CASCADE' })
    user: NestAuthUser;

    @ManyToOne(() => NestAuthTenant, { onDelete: 'CASCADE' })
    tenant: NestAuthTenant;

    /** Roles for this tenant membership. When set, they override user-level roles for this tenant. */
    @ManyToMany(() => NestAuthRole, role => role.tenantMemberships, { onDelete: 'CASCADE' })
    @JoinTable({
        name: 'nest_auth_tenant_membership_roles',
        joinColumn: { name: 'nestAuthTenantMembershipId', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'nestAuthRolesId', referencedColumnName: 'id' },
    })
    roles: NestAuthRole[];

    @Column({ default: true })
    isActive: boolean;

    @Column({ type: 'simple-json', nullable: true, default: '{}' })
    metadata?: Record<string, any>;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}

import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    RelationId,
    Index,
    ManyToMany,
    JoinTable,
    BaseEntity,
    IsNull,
    In,
    Equal,
} from 'typeorm';
import { NestAuthTenant } from '../../tenant/entities/tenant.entity';
import { NestAuthUser } from './user.entity';
import { NestAuthRole } from '../../role/entities/role.entity';
import { chain } from 'lodash';
import { getRolePermissionNames } from '../../role/utils/role-mapper.util';

@Entity('nest_auth_user_accesses')
@Index('UQ_user_tenant_not_null', ['userId', 'tenantId'], {
    unique: true,
    where: `"tenantId" IS NOT NULL`,
})
@Index('UQ_user_null_tenant', ['userId'], {
    unique: true,
    where: `"tenantId" IS NULL`,
})
export class NestAuthUserAccess extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ nullable: false })
    @Index()
    @RelationId((access: NestAuthUserAccess) => access.user)
    userId: string;

    @Column({ nullable: true })
    @Index()
    @RelationId((access: NestAuthUserAccess) => access.tenant)
    tenantId: string;

    @ManyToOne(() => NestAuthUser, { onDelete: 'CASCADE' })
    user: NestAuthUser;

    @ManyToOne(() => NestAuthTenant, { onDelete: 'CASCADE', nullable: true })
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

    async getPermissions(tenantId: string | null): Promise<string[]> {
        const roles = await this.getRoles(tenantId, true);
        return chain(roles)
            .map((role) => getRolePermissionNames(role))
            .flatten()
            .uniq()
            .value();
    }

    async getRoles(tenantId?: string | null, withPermissions = false): Promise<NestAuthRole[]> {
        const access = await NestAuthUserAccess.findOne({
            where: { userId: this.userId, tenantId: tenantId ? Equal(tenantId) : IsNull() },
            relations: ['roles', ...(withPermissions ? ['roles.rolePermissions', 'roles.rolePermissions.permission'] : [])],
        });

        return access?.roles?.length ? access.roles : [];
    }

    /** Assign multiple roles for a specific tenant (stores on user access). */
    async assignRoles(roleIds: string | string[], tenantId?: string | null): Promise<void> {
        const access = await this.getOrCreateUserAccess(tenantId);
        const ids = Array.isArray(roleIds) ? roleIds : [roleIds];
        access.roles = ids.length
            ? await NestAuthRole.find({ where: { id: In(ids) } })
            : [];
        await access.save();
    }

    private async getOrCreateUserAccess(tenantId?: string | null): Promise<NestAuthUserAccess> {
        let access = await NestAuthUserAccess.findOne({
            where: { userId: Equal(this.userId), tenantId: tenantId ? Equal(tenantId) : IsNull() },
            relations: ['roles'],
        });
        if (!access) {
            access = NestAuthUserAccess.create({ userId: this.userId, ...tenantId ? { tenantId } : {} });
            await access.save();
            access.roles = []; // Initialize for consistency
        }
        return access;
    }

}

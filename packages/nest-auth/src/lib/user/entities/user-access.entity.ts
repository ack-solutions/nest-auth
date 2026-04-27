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
    EntityManager,
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

    /**
     * Replace this user-access's roles with the provided ones.
     * Pass `manager` to participate in a transaction.
     */
    async assignRoles(roleIds: string | string[], manager?: EntityManager): Promise<void> {
        const ids = Array.isArray(roleIds) ? roleIds : [roleIds];

        const roleRepo = manager
            ? manager.getRepository(NestAuthRole)
            : NestAuthRole.getRepository();
        const accessRepo = manager
            ? manager.getRepository(NestAuthUserAccess)
            : NestAuthUserAccess.getRepository();

        this.roles = ids.length
            ? await roleRepo.find({ where: { id: In(ids) } })
            : [];

        await accessRepo.save(this);
    }

}

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, BaseEntity, Unique, ManyToOne, RelationId, ManyToMany, JoinTable } from "typeorm";
import { uniq } from "lodash";
import { DEFAULT_GUARD_NAME } from "../../auth.constants";
import { NestAuthTenant } from "../../tenant/entities/tenant.entity";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { NestAuthUser } from "../../user/entities/user.entity";

@Entity('nest_auth_roles')
@Unique(['name', 'guard', 'tenantId'])
export class NestAuthRole extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ nullable: true, default: DEFAULT_GUARD_NAME })
    guard: string;

    @Column({ nullable: true })
    @RelationId((role: NestAuthRole) => role.tenant)
    tenantId: string;

    @ManyToOne(() => NestAuthTenant, { onDelete: 'CASCADE' })
    tenant: NestAuthTenant;

    @Column({ default: false })
    isSystem: boolean;

    @Column({ default: true })
    isActive: boolean;

    @Column({
        type: 'simple-json',
        nullable: true,
        default: '{}'
    })
    permissions: string[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToMany(() => NestAuthUser, user => user.roles, { onDelete: 'CASCADE' })
    @JoinTable({
        name: 'nest_auth_role_nest_auth_users',
        joinColumn: {
            name: 'nestAuthRolesId',
            referencedColumnName: 'id',
        },
        inverseJoinColumn: {
            name: 'nestAuthUsersId',
            referencedColumnName: 'id',
        },
    })
    users: NestAuthUser[];

    static async createRole(
        name: string,
        guard: string = DEFAULT_GUARD_NAME,
        isSystem: boolean = false,
        tenantId: string
    ): Promise<NestAuthRole> {

        // Check if system role with same name exists
        const existingSystemRole = await NestAuthRole.findOne({
            where: { name, isSystem: true }
        });
        if (existingSystemRole) {
            throw new ConflictException(`Cannot create role with name '${name}' as it conflicts with a system role`);
        }

        if (!isSystem && !tenantId) {
            throw new BadRequestException('Tenant ID is required');
        }

        const role = new NestAuthRole();
        role.name = name;
        role.guard = guard;
        role.isSystem = isSystem;
        role.tenantId = isSystem ? null : tenantId;
        await role.save();
        return role;
    }

    async syncPermissions(permissions: string | string[]): Promise<void> {
        const newPermissions = Array.isArray(permissions) ? permissions : [permissions];
        this.permissions = newPermissions;
    }

    async removePermissions(permissions: string | string[]): Promise<void> {
        const removingPermissions = Array.isArray(permissions) ? permissions : [permissions];
        this.permissions = this.permissions.filter(permission => !removingPermissions.includes(permission));
    }

    async attachPermissions(permissions: string | string[]): Promise<void> {
        const existingPermissions = this.permissions;
        const newPermissions = Array.isArray(permissions) ? permissions : [permissions];
        this.permissions = uniq([...existingPermissions, ...newPermissions]);
    }
}

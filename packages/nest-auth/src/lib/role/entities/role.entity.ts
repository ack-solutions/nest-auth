import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    BaseEntity,
    Unique,
    ManyToOne,
    RelationId,
    ManyToMany,
    JoinTable,
    OneToMany,
} from "typeorm";
import { DEFAULT_GUARD_NAME } from "../../auth.constants";
import { NestAuthTenant } from "../../tenant/entities/tenant.entity";
import { NestAuthUser } from "../../user/entities/user.entity";
import { NestAuthUserAccess } from "../../tenant/entities/user-access.entity";
import { NestAuthRolePermission } from "./role-permission.entity";

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

    @OneToMany(() => NestAuthRolePermission, rolePermission => rolePermission.role)
    rolePermissions: NestAuthRolePermission[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToMany(() => NestAuthUserAccess, access => access.roles, { onDelete: 'CASCADE' })
    userAccesses: NestAuthUserAccess[];
}

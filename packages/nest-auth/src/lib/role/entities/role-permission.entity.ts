import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    RelationId,
    Unique,
} from 'typeorm';
import { NestAuthPermission } from '../../permission/entities/permission.entity';
import { NestAuthRole } from './role.entity';

@Entity('nest_auth_role_permissions')
@Unique('UQ_role_permission_unique', ['roleId', 'permissionId'])
export class NestAuthRolePermission extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    @Index()
    @RelationId((rolePermission: NestAuthRolePermission) => rolePermission.role)
    roleId: string;

    @Column({ type: 'uuid' })
    @Index()
    @RelationId((rolePermission: NestAuthRolePermission) => rolePermission.permission)
    permissionId: string;

    @ManyToOne(() => NestAuthRole, role => role.rolePermissions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'roleId' })
    role: NestAuthRole;

    @ManyToOne(() => NestAuthPermission, permission => permission.rolePermissions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'permissionId' })
    permission: NestAuthPermission;

    @CreateDateColumn()
    createdAt: Date;
}

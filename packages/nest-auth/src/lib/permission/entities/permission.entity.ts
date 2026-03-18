import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    BaseEntity,
    Index,
    Unique,
    OneToMany,
} from 'typeorm';
import { DEFAULT_GUARD_NAME } from '../../auth.constants';
import { NestAuthRolePermission } from '../../role/entities/role-permission.entity';

/**
 * Permissions are unique per (name, guard) combination and are assigned to roles
 * through the nest_auth_role_permissions pivot table.
 */
@Entity('nest_auth_permissions')
@Unique(['name', 'guard'])
export class NestAuthPermission extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    @Index()
    name: string;

    @Column({ nullable: true, default: DEFAULT_GUARD_NAME })
    @Index()
    guard: string;

    @Column({ nullable: true, type: 'text' })
    description?: string;

    @Column({ nullable: true })
    category?: string; // e.g., 'users', 'posts', 'admin', etc.

    @Column({ type: 'simple-json', nullable: true, default: '{}' })
    metadata?: Record<string, any>;

    @OneToMany(() => NestAuthRolePermission, rolePermission => rolePermission.permission)
    rolePermissions: NestAuthRolePermission[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}

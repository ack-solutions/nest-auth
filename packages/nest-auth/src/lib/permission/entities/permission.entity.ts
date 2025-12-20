import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    BaseEntity,
    Index,
    Unique,
} from 'typeorm';
import { DEFAULT_GUARD_NAME } from '../../auth.constants';

/**
 * Permission Registry Entity
 *
 * This table acts as a registry/suggestions list for permissions.
 * Roles store permission names as JSON strings (not foreign keys),
 * so deleting a permission from this table won't break existing roles.
 *
 * Purpose:
 * - Provides autocomplete/suggestions when adding permissions to roles
 * - Prevents typos and ensures consistency
 * - Allows tracking permission descriptions and metadata
 * - Can be used for permission documentation/management
 *
 * Note: Permissions are unique per (name, guard) combination
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

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}

import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    RelationId,
    Index,
    ManyToMany,
    JoinTable,
    BaseEntity,
    OneToOne,
    In,
} from 'typeorm';
import { NestAuthUser } from './user.entity';
import { NestAuthRole } from '../../role/entities/role.entity';
import { chain } from 'lodash';
import { getRolePermissionNames } from '../../role/utils/role-mapper.util';

@Entity('nest_auth_platform_accesses')
export class NestAuthPlatformAccess extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ nullable: false })
    @Index()
    @RelationId((access: NestAuthPlatformAccess) => access.user)
    userId: string;

    @OneToOne(() => NestAuthUser, (user) => user.platformAccess, { onDelete: 'CASCADE' })
    user: NestAuthUser;

    /** Multiple roles for this user access (tenant-specific). */
    @ManyToMany(() => NestAuthRole, role => role.platformAccesses, { onDelete: 'CASCADE' })
    @JoinTable({
        name: 'nest_auth_platform_access_roles',
        joinColumn: { name: 'nestAuthPlatformAccessId', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'nestAuthRolesId', referencedColumnName: 'id' },
    })
    roles: NestAuthRole[];

    @Column({ default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;


    async getPermissions(): Promise<string[]> {
        const roles = await this.getRoles(true);
        return chain(roles)
            .map((role) => getRolePermissionNames(role))
            .flatten()
            .uniq()
            .value();
    }

    async getRoles(withPermissions = false): Promise<NestAuthRole[]> {
        const access = await NestAuthPlatformAccess.findOne({
            where: { userId: this.userId, isActive: true },
            relations: ['roles', ...(withPermissions ? ['roles.rolePermissions', 'roles.rolePermissions.permission'] : [])],
        });

        return access?.roles?.length ? access.roles : [];
    }

    /** Assign multiple roles for a specific tenant (stores on user access). */
    async assignRoles(roleIds: string | string[]): Promise<void> {
        const ids = Array.isArray(roleIds) ? roleIds : [roleIds];
        this.roles = ids.length
            ? await NestAuthRole.find({ where: { id: In(ids) } })
            : [];
        await this.save();
    }
}

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
    JoinColumn,
    EntityManager,
} from 'typeorm';
import { NestAuthUser } from './user.entity';
import { NestAuthRole } from '../../role/entities/role.entity';
import { chain } from 'lodash';
import { getRolePermissionNames } from '../../role/utils/role-mapper.util';

@Entity('nest_auth_platform_accesses')
export class NestAuthPlatformAccess extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ nullable: false, unique: true })
    @Index()
    userId: string;

    @OneToOne(() => NestAuthUser, user => user.platformAccess, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
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

    /**
     * Replace this platform-access's roles with the provided ones.
     * Pass `manager` to participate in a transaction.
     */
    async assignRoles(roleIds: string | string[], manager?: EntityManager): Promise<void> {
        const ids = Array.isArray(roleIds) ? roleIds : [roleIds];

        const roleRepo = manager
            ? manager.getRepository(NestAuthRole)
            : NestAuthRole.getRepository();
        const accessRepo = manager
            ? manager.getRepository(NestAuthPlatformAccess)
            : NestAuthPlatformAccess.getRepository();

        this.roles = ids.length
            ? await roleRepo.find({ where: { id: In(ids) } })
            : [];

        await accessRepo.save(this);
    }
}

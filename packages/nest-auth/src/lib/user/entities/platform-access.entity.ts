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
} from 'typeorm';
import { NestAuthUser } from './user.entity';
import { NestAuthRole } from '../../role/entities/role.entity';

@Entity('nest_auth_platform_accesses')
export class NestAuthPlatformAccess extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ nullable: false })
    @Index()
    @RelationId((access: NestAuthPlatformAccess) => access.user)
    userId: string;

    @OneToOne(() => NestAuthUser, { onDelete: 'CASCADE' })
    user: NestAuthUser;

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

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}

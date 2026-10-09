import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    BaseEntity,
    RelationId,
    JoinColumn
} from "typeorm";
import { NestAuthUser } from "./user.entity";

@Entity('nest_auth_access_keys')
export class NestAuthAccessKey extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ unique: true })
    publicKey: string;

    @Column()
    privateKey: string;

    @Column({ nullable: true })
    description?: string;

    @Column({ default: true })
    isActive: boolean;

    @Column({ nullable: true })
    expiresAt?: Date;

    @Column({ nullable: true })
    lastUsedAt?: Date;

    /**
     * Tenant this key acts in. Optional: when unset, the key acts in the user's
     * only ACTIVE membership (always the case in ISOLATED mode). Pin it for a
     * user who belongs to several tenants — otherwise the request carries no
     * tenant and cannot be scoped.
     */
    @Column({ type: 'varchar', nullable: true })
    tenantId?: string | null;

    @Column()
    @RelationId((accessKey: NestAuthAccessKey) => accessKey.user)
    userId: string;

    @ManyToOne(() => NestAuthUser, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: NestAuthUser;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}

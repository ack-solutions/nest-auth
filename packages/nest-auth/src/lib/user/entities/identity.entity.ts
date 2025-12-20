import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, RelationId, JoinColumn, BaseEntity } from "typeorm";
import { NestAuthUser } from "./user.entity";

@Entity('nest_auth_identities')
export class NestAuthIdentity extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    provider: string;

    @Column({ nullable: true })
    providerId: string;

    @Column({ type: 'simple-json', nullable: true, default: '{}' })
    metadata: Record<string, any>;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Column({ nullable: true })
    @RelationId((identity: NestAuthIdentity) => identity.user)
    userId: string;

    @ManyToOne(() => NestAuthUser, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: NestAuthUser;
}

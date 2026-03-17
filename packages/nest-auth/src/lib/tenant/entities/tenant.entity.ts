import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm";
import { NestAuthUserAccess } from "./user-access.entity";

@Entity('nest_auth_tenants')
export class NestAuthTenant {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ unique: true, nullable: true })
    slug: string;

    @OneToMany(() => NestAuthUserAccess, access => access.tenant)
    userAccesses: NestAuthUserAccess[];

    @Column({ nullable: true })
    description: string;

    @Column({ type: 'simple-json', nullable: true, default: '{}' })
    metadata: Record<string, any>;

    @Column({ default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

}

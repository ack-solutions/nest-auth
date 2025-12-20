import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity('nest_auth_tenants')
export class NestAuthTenant {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    /**
     * Unique slug/identifier for the tenant
     * Format: lowercase, letters, numbers, hyphens, underscores only
     * Examples: 'my-app', 'acme_corp', 'tenant123'
     */
    @Column({ unique: true, nullable: true })
    slug: string;

    /**
     * @deprecated Use 'slug' instead. Will be removed in v2.0.0
     * Legacy domain field - kept for backward compatibility
     */
    @Column({ unique: true, nullable: true })
    domain: string;

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

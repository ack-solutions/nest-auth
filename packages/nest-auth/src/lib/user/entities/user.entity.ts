import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    BaseEntity,
    Index,
    BeforeInsert,
    BeforeUpdate,
    ManyToMany,
    In,
} from "typeorm";
import { hash, verify, Algorithm } from '@node-rs/argon2';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { NestAuthTenant } from "../../tenant/entities/tenant.entity";
import { NestAuthIdentity } from "./identity.entity";
import { NestAuthSession } from "../../session/entities/session.entity";
import { chain } from "lodash";
import { NestAuthOTP } from "../../auth/entities/otp.entity";
import { NestAuthMFASecret } from "../../auth/entities/mfa-secret.entity";
import { NestAuthRole } from "../../role/entities/role.entity";

@Entity('nest_auth_users')
export class NestAuthUser extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ nullable: true })
    @Index()
    email: string;

    @Column({ nullable: true })
    @Index()
    emailVerifiedAt: Date;

    @Column({ nullable: true })
    @Index()
    phone: string;

    @Column({ nullable: true })
    @Index()
    phoneVerifiedAt: Date;

    @Column({ nullable: true })
    passwordHash: string;

    @Column({ default: false })
    isVerified: boolean;

    @Column({ default: true })
    isActive: boolean;

    @Column({ type: 'simple-json', nullable: true, default: '{}' })
    metadata?: Record<string, any>;

    @Column({ nullable: true })
    tenantId?: string;

    @Column({ default: false })
    isMfaEnabled: boolean;

    @Column({ nullable: true })
    mfaRecoveryCode?: string;

    @ManyToOne(() => NestAuthTenant, { onDelete: 'CASCADE' })
    tenant: NestAuthTenant;

    @OneToMany(() => NestAuthIdentity, identity => identity.user)
    identities: NestAuthIdentity[];

    @OneToMany(() => NestAuthMFASecret, mfaSecret => mfaSecret.user)
    mfaSecrets: NestAuthMFASecret[];

    @OneToMany(() => NestAuthSession, session => session.user)
    sessions: NestAuthSession[];

    @OneToMany(() => NestAuthOTP, otp => otp.user)
    otps: NestAuthOTP[];

    @ManyToMany(() => NestAuthRole, role => role.users, { onDelete: 'CASCADE' })
    roles: NestAuthRole[];

    @Index('IDX_USER_EMAIL_TENANT', { unique: true })
    @Column({ nullable: true })
    emailTenant: string;

    @Index('IDX_USER_PHONE_TENANT', { unique: true })
    @Column({ nullable: true })
    phoneTenant: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;



    @BeforeInsert()
    @BeforeUpdate()
    updateTenantFields() {
        // Normalize email to lowercase for consistency
        if (this.email) {
            this.email = this.email.toLowerCase().trim();
        }
        this.emailTenant = this.email ? `${this.email}:${this.tenantId || 'global'}` : null;
        this.phoneTenant = this.phone ? `${this.phone}:${this.tenantId || 'global'}` : null;
    }

    async getPermissions(): Promise<string[]> {
        if (!this.roles) {
            this.roles = await NestAuthRole.find({
                select: {
                    id: true,
                    name: true,
                    permissions: true
                },
                where: { users: { id: this.id }, tenantId: this.tenantId }
            });
        }
        return chain(this.roles)
            .map(role => role.permissions)
            .flatten()
            .uniq()
            .value();
    }

    async getRoles(): Promise<NestAuthRole[]> {
        if (!this.roles) {
            this.roles = await NestAuthRole.find({
                select: {
                    id: true,
                    name: true,
                    isSystem: true,
                    guard: true,
                },
                where: { users: { id: this.id }, tenantId: this.tenantId }
            });
        }
        return this.roles;
    }

    async assignRoles(roles: string | string[], guard: string): Promise<void> {
        // Find both system roles and tenant - specific roles
        this.roles = await NestAuthRole.find({
            where: [
            // System roles (tenantId is null)
                { name: In(Array.isArray(roles) ? roles : [roles]), isSystem: true, guard },
            // Tenant-specific roles
                { name: In(Array.isArray(roles) ? roles : [roles]), tenantId: this.tenantId, isSystem: false, guard }
            ]
        });
    }

    async assignRolesWithMutipleGuard(roles: { name: string; guard: string } | { name: string; guard: string }[]): Promise<void> {
        const roleAssignments = Array.isArray(roles) ? roles : [roles];
        if (roleAssignments.length === 0) {
            this.roles = [];
            return;
        }

        // Build where conditions for each role with its specific guard
        const whereConditions = roleAssignments.flatMap(({ name, guard }) => [
            { name, isSystem: true, guard },
            { name, tenantId: this.tenantId, isSystem: false, guard }
        ]);

        this.roles = await NestAuthRole.find({ where: whereConditions });
    }
    async findOrCreateIdentity(provider: string, providerId: string) {
        const existingIdentity = await NestAuthIdentity.findOne({
            where: { provider, providerId, userId: this.id }
        });

        if (existingIdentity) {
            return existingIdentity;
        }

        const identity = new NestAuthIdentity();
        identity.provider = provider;
        identity.providerId = providerId;
        identity.user = this;

        return identity.save();
    }

    async updateOrCreateIdentity(
        provider: string,
        data: Partial<NestAuthIdentity>
    ): Promise<NestAuthIdentity> {
        let identity = {} as NestAuthIdentity;
        if (provider) {
            identity = await NestAuthIdentity.findOne({
                where: { provider, userId: this.id },
            });
        }

        identity = NestAuthIdentity.create<NestAuthIdentity>({
            provider,
            ...identity,
            ...data,
            userId: this.id,
        });
        return identity.save();
    }

    async validatePassword(password: string): Promise<boolean> {
        if (!this.passwordHash) return false;

        // Apply password.verify hook if configured
        const options = AuthConfigService.getOptions();
        if (options.password?.verify) {
            return await options.password.verify(password, this.passwordHash);
        }

        try {
            return await verify(this.passwordHash, password);
        } catch (error) {
            // Invalid hash format or verification error
            return false;
        }
    }

    async setPassword(password: string): Promise<void> {
        const options = AuthConfigService.getOptions();

        // Apply password.validate hook if configured
        if (options.password?.validate) {
            const isValid = await options.password.validate(password);
            if (!isValid) {
                throw new Error('Password does not meet requirements');
            }
        }

        // Apply password.hash hook if configured
        if (options.password?.hash) {
            this.passwordHash = await options.password.hash(password);
            return;
        }

        // Argon2id is the recommended variant (hybrid of Argon2i and Argon2d)
        this.passwordHash = await hash(password, {
            algorithm: Algorithm.Argon2id,
            memoryCost: 65536, // 64 MiB
            timeCost: 3,       // 3 iterations
            parallelism: 4     // 4 parallel threads
        });
    }
}

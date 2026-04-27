import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    BaseEntity,
    Index,
    BeforeInsert,
    BeforeUpdate,
    OneToOne,
    Equal,
    EntityManager,
    IsNull,
} from "typeorm";
import { hash, verify, Algorithm } from '@node-rs/argon2';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { NestAuthIdentity } from "./identity.entity";
import { NestAuthSession } from "../../session/entities/session.entity";
import { NestAuthOTP } from "../../auth/entities/otp.entity";
import { NestAuthMFASecret } from "../../auth/entities/mfa-secret.entity";
import { NestAuthUserAccess } from "./user-access.entity";
import { EMAIL_AUTH_PROVIDER, PHONE_AUTH_PROVIDER } from "../../auth.constants";
import { normalizedPhone, requiredTenant } from '../../utils';
import { NestAuthPlatformAccess } from "./platform-access.entity";

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

    @Column({ nullable: true , select: false})
    passwordHash: string;

    @Column({ default: true })
    isActive: boolean;

    @Column({ type: 'simple-json', nullable: true, default: '{}' })
    metadata?: Record<string, any>;

    @Column({ default: false })
    isMfaEnabled: boolean;

    @Column({ nullable: true })
    mfaRecoveryCode?: string;

    @OneToMany(() => NestAuthIdentity, identity => identity.user)
    identities: NestAuthIdentity[];

    @OneToMany(() => NestAuthMFASecret, mfaSecret => mfaSecret.user)
    mfaSecrets: NestAuthMFASecret[];

    @OneToMany(() => NestAuthSession, session => session.user)
    sessions: NestAuthSession[];

    @OneToMany(() => NestAuthOTP, otp => otp.user)
    otps: NestAuthOTP[];

    @OneToMany(() => NestAuthUserAccess, access => access.user)
    userAccesses: NestAuthUserAccess[];

    @OneToOne(() => NestAuthPlatformAccess, access => access.user)
    platformAccess: NestAuthPlatformAccess;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @BeforeInsert()
    @BeforeUpdate()
    updateTenantFields() {
        if (this.email) {
            this.email = this.email.toLowerCase().trim();
        }
    }

    /**
     * Get the user's `userAccess` row for a tenant, optionally creating one
     * if missing. Pass `manager` to participate in a transaction.
     */
    async getUserAccess(
        tenantId: string = null,
        createIfNotExists: boolean = false,
        manager?: EntityManager,
    ) {
        const repo = manager
            ? manager.getRepository(NestAuthUserAccess)
            : NestAuthUserAccess.getRepository();

        const existingUserAccess = await repo.findOne({
            where: { userId: this.id, tenantId: tenantId ? Equal(tenantId) : IsNull() }
        });
        if (existingUserAccess) {
            return existingUserAccess;
        }
        if (createIfNotExists) {
            const userAccess = repo.create({ userId: this.id, tenantId });
            await repo.save(userAccess);
            return userAccess;
        }
        return null;
    }

    /**
     * Get the user's `platformAccess` row, optionally creating one if missing.
     * Pass `manager` to participate in a transaction.
     */
    async getPlatformAccess(createIfNotExists: boolean = false, manager?: EntityManager) {
        const repo = manager
            ? manager.getRepository(NestAuthPlatformAccess)
            : NestAuthPlatformAccess.getRepository();

        const existingPlatformAccess = await repo.findOne({
            where: { userId: this.id }
        });
        if (existingPlatformAccess) {
            return existingPlatformAccess;
        }
        if (createIfNotExists) {
            const platformAccess = repo.create({ userId: this.id });
            await repo.save(platformAccess);
            return platformAccess;
        }
        return null;
    }

    /**
     * Idempotently link an identity row (provider + providerId) to this user.
     * Pass `manager` to run inside a transaction.
     */
    async findOrCreateIdentity(provider: string, providerId: string, manager?: EntityManager) {
        const repo = manager
            ? manager.getRepository(NestAuthIdentity)
            : NestAuthIdentity.getRepository();

        const existingIdentity = await repo.findOne({
            where: { provider, providerId, userId: this.id }
        });

        if (existingIdentity) {
            return existingIdentity;
        }

        const identity = repo.create({
            provider,
            providerId,
            userId: this.id,
        });

        return repo.save(identity);
    }

    /**
     * Update an identity row's fields, or create the row when missing.
     * Pass `manager` to run inside a transaction.
     */
    async updateOrCreateIdentity(
        provider: string,
        data: Partial<NestAuthIdentity>,
        manager?: EntityManager,
    ): Promise<NestAuthIdentity> {
        const repo = manager
            ? manager.getRepository(NestAuthIdentity)
            : NestAuthIdentity.getRepository();

        // Find existing identity by provider and userId
        const existingIdentity = await repo.findOne({
            where: { provider, userId: this.id },
        });

        if (existingIdentity) {
            // Update existing identity
            Object.assign(existingIdentity, data);
            return repo.save(existingIdentity);
        }

        // Create new identity if none exists
        const newIdentity = repo.create({
            provider,
            userId: this.id,
            ...data,
        });
        return repo.save(newIdentity);
    }

    /**
     * Update user email and sync the email identity (providerId).
     * Clears `emailVerifiedAt` when the email actually changes.
     * Pass `manager` to participate in a transaction.
     */
    async updateEmail(newEmail: string, manager?: EntityManager): Promise<void> {
        const normalized = newEmail ? newEmail.toLowerCase().trim() : null;
        const previousEmail = this.email?.toLowerCase().trim() ?? null;
        this.email = normalized ?? undefined;
        if (previousEmail !== normalized) {
            this.emailVerifiedAt = null;
        }

        const identityRepo = manager
            ? manager.getRepository(NestAuthIdentity)
            : NestAuthIdentity.getRepository();
        const userRepo = manager
            ? manager.getRepository(NestAuthUser)
            : NestAuthUser.getRepository();

        if (normalized) {
            await this.updateOrCreateIdentity(EMAIL_AUTH_PROVIDER, { providerId: normalized }, manager);
        } else {
            const identity = await identityRepo.findOne({
                where: { userId: this.id, provider: EMAIL_AUTH_PROVIDER },
            });
            if (identity) {
                await identityRepo.remove(identity);
            }
        }
        await userRepo.save(this);
    }

    /**
     * Update user phone and sync the phone identity (providerId).
     * Clears `phoneVerifiedAt` when the phone actually changes.
     * Pass `manager` to participate in a transaction.
     */
    async updatePhone(newPhone: string | null | undefined, manager?: EntityManager): Promise<void> {
        const value = normalizedPhone(newPhone);
        const previousPhone = normalizedPhone(this.phone) ?? null;
        this.phone = value ?? undefined;
        if (previousPhone !== value) {
            this.phoneVerifiedAt = null;
        }

        const identityRepo = manager
            ? manager.getRepository(NestAuthIdentity)
            : NestAuthIdentity.getRepository();
        const userRepo = manager
            ? manager.getRepository(NestAuthUser)
            : NestAuthUser.getRepository();

        if (value) {
            await this.updateOrCreateIdentity(PHONE_AUTH_PROVIDER, { providerId: value }, manager);
        } else {
            const identity = await identityRepo.findOne({
                where: { userId: this.id, provider: PHONE_AUTH_PROVIDER },
            });
            if (identity) {
                await identityRepo.remove(identity);
            }
        }
        await userRepo.save(this);
    }

    async validatePassword(password: string): Promise<boolean> {
        let passwordHash = this.passwordHash;
        if (!this.passwordHash) {
            const user = await NestAuthUser.createQueryBuilder('user').select('user.passwordHash').where('user.id = :id', { id: this.id }).getOne();
            if (!user?.passwordHash) {
                return false;
            }
            passwordHash = user.passwordHash;
        };

        // Apply password.verify hook if configured
        const options = AuthConfigService.getOptions();

        const hasCustomHash = !!options.password?.hash;
        const hasCustomVerify = !!options.password?.verify;
        if (hasCustomHash !== hasCustomVerify) {
            throw new Error('password.hash and password.verify must be provided together');
        }

        if (hasCustomVerify) {
            return await options.password.verify(password, passwordHash);
        }

        try {
            return await verify(passwordHash, password);
        } catch (error) {
            // Invalid hash format or verification error
            return false;
        }
    }

    async setPassword(password: string): Promise<void> {
        const options = AuthConfigService.getOptions();

        const hasCustomHash = !!options.password?.hash;
        const hasCustomVerify = !!options.password?.verify;
        if (hasCustomHash !== hasCustomVerify) {
            throw new Error('password.hash and password.verify must be provided together');
        }

        if (hasCustomHash) {
            this.passwordHash = await options.password.hash(password);
            return;
        }

        this.passwordHash = await hash(password, {
            algorithm: Algorithm.Argon2id,
            memoryCost: options.password?.argon2?.memoryCost ?? 65536,
            timeCost: options.password?.argon2?.timeCost ?? 3,
            parallelism: options.password?.argon2?.parallelism ?? 4,
        });
    }
}

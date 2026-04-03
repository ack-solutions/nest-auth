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

    @Column({ nullable: true })
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

    async getUserAccess(tenantId: string = null, createIfNotExists: boolean = false) {
        const existingUserAccess = await NestAuthUserAccess.findOne({
            where: { userId: this.id, tenantId: tenantId ? Equal(tenantId) : IsNull() }
        });
        if (existingUserAccess) {
            return existingUserAccess;
        }
        if (createIfNotExists) {
            const userAccess = NestAuthUserAccess.create({ userId: this.id, tenantId });
            await userAccess.save();
            return userAccess;
        }
        return null;
    }

    async getPlatformAccess(createIfNotExists: boolean = false) {
        const existingPlatformAccess = await NestAuthPlatformAccess.findOne({
            where: { userId: this.id }
        });
        if (existingPlatformAccess) {
            return existingPlatformAccess;
        }
        if (createIfNotExists) {
            const platformAccess = NestAuthPlatformAccess.create({ userId: this.id });
            await platformAccess.save();
            return platformAccess;
        }
        return null;
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
        // Find existing identity by provider and userId
        const existingIdentity = await NestAuthIdentity.findOne({
            where: { provider, userId: this.id },
        });

        if (existingIdentity) {
            // Update existing identity
            Object.assign(existingIdentity, data);
            return existingIdentity.save();
        }

        // Create new identity if none exists
        const newIdentity = NestAuthIdentity.create<NestAuthIdentity>({
            provider,
            userId: this.id,
            ...data,
        });
        return newIdentity.save();
    }

    /**
     * Update user email and sync the email identity (providerId). Clears emailVerifiedAt when email changes.
     */
    async updateEmail(newEmail: string): Promise<void> {
        const normalized = newEmail ? newEmail.toLowerCase().trim() : null;
        const previousEmail = this.email?.toLowerCase().trim() ?? null;
        this.email = normalized ?? undefined;
        if (previousEmail !== normalized) {
            this.emailVerifiedAt = null;
        }
        if (normalized) {
            await this.updateOrCreateIdentity(EMAIL_AUTH_PROVIDER, { providerId: normalized });
        } else {
            const identity = await NestAuthIdentity.findOne({
                where: { userId: this.id, provider: EMAIL_AUTH_PROVIDER },
            });
            if (identity) {
                await identity.remove();
            }
        }
        await this.save();
    }

    /**
     * Update user phone and sync the phone identity (providerId). Clears phoneVerifiedAt when phone changes.
     */
    async updatePhone(newPhone: string | null | undefined): Promise<void> {
        const value = normalizedPhone(newPhone);
        const previousPhone = normalizedPhone(this.phone) ?? null;
        this.phone = value ?? undefined;
        if (previousPhone !== value) {
            this.phoneVerifiedAt = null;
        }
        if (value) {
            await this.updateOrCreateIdentity(PHONE_AUTH_PROVIDER, { providerId: value });
        } else {
            const identity = await NestAuthIdentity.findOne({
                where: { userId: this.id, provider: PHONE_AUTH_PROVIDER },
            });
            if (identity) {
                await identity.remove();
            }
        }
        await this.save();
    }

    async validatePassword(password: string): Promise<boolean> {
        if (!this.passwordHash) return false;

        // Apply password.verify hook if configured
        const options = AuthConfigService.getOptions();

        const hasCustomHash = !!options.password?.hash;
        const hasCustomVerify = !!options.password?.verify;
        if (hasCustomHash !== hasCustomVerify) {
            throw new Error('password.hash and password.verify must be provided together');
        }

        if (hasCustomVerify) {
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

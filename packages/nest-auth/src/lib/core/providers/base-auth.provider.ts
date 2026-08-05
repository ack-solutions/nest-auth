import { Equal, Repository } from 'typeorm';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthIdentity } from '../../user/entities/identity.entity';
import { AuthConfigService } from '../services/auth-config.service';
import { IAuthModuleOptions } from '../interfaces/auth-module-options.interface';
import { NestAuthLoginRequestDto } from '../../auth/dto/requests/login.request.dto';

export interface AuthProviderUser {
    /**
     * The provider's identifier for the authenticated principal.
     *
     * For FIRST-PARTY providers (email/phone/passwordless) this is our own
     * `NestAuthUser.id` (a UUID). For SOCIAL / external providers (Google,
     * Apple, Facebook, GitHub, a federated JWT, custom SSO) it is the EXTERNAL
     * subject — the OAuth `sub` / account id — which is stored as
     * `auth_identity.providerId`, NOT as our UUID.
     *
     * Because of that split, the login flow must not blindly treat this as our
     * user id: it calls {@link BaseAuthProvider.findLinkedIdentity}, which the
     * social providers override to resolve by `providerId` instead. See
     * `SocialAuthProvider`.
     */
    userId: string;
    email?: string;
    phone?: string;
    username?: string;
    metadata?: Record<string, any>;
    /**
     * Set to `true` when the provider attests that this email belongs to
     * the user (e.g. Google's `email_verified` claim, or a verified primary
     * email returned by GitHub). The auth service will lift `emailVerifiedAt`
     * on the linked `NestAuthUser` when this is `true`.
     */
    emailVerified?: boolean;
    /**
     * Set to `true` when the provider attests that this phone belongs to
     * the user. Lifts `phoneVerifiedAt` on the linked `NestAuthUser`.
     */
    phoneVerified?: boolean;
}

export type LinkUserWith = 'email' | 'phone';


export abstract class BaseAuthProvider {
    abstract providerName: string;
    enabled: boolean;
    skipMfa = false;

    /**
     * Live module options — read lazily, never captured. Capturing at
     * construction is stale under forRootAsync (see JwtService); getOptions() is
     * a cheap static read.
     */
    get options(): IAuthModuleOptions {
        return AuthConfigService.getOptions();
    }

    // Repositories the base helpers (linkToUser / findIdentity / …) use. Built-in
    // providers inject them via the constructor; CUSTOM providers registered
    // through `customAuthProviders` are built by the consumer without DI access to
    // the repos, so the provider registry calls `attachRepositories()` on them.
    protected userRepository!: Repository<NestAuthUser>;
    protected authIdentityRepository!: Repository<NestAuthIdentity>;

    constructor(
        userRepository?: Repository<NestAuthUser>,
        authIdentityRepository?: Repository<NestAuthIdentity>,
    ) {
        if (userRepository) this.userRepository = userRepository;
        if (authIdentityRepository) this.authIdentityRepository = authIdentityRepository;
    }

    /**
     * Inject the user + identity repositories after construction. Used by the
     * provider registry for custom providers (which the consumer builds without
     * DI access to the repos). No-op for a slot that's already set — so a provider
     * that DID receive repos via its constructor keeps them.
     */
    attachRepositories(
        userRepository: Repository<NestAuthUser>,
        authIdentityRepository: Repository<NestAuthIdentity>,
    ): void {
        this.userRepository ??= userRepository;
        this.authIdentityRepository ??= authIdentityRepository;
    }

    /**
     * Link a provider identity to a user
     * Checks for existing identity before creating to prevent duplicates
     */
    async linkToUser(userId: string, providerId: string, metadata?: Record<string, any>): Promise<void> {
        // Check if identity already exists to prevent duplicates
        const existingIdentity = await this.authIdentityRepository.findOne({
            where: {
                userId,
                provider: this.providerName,
                providerId: providerId,
            },
        });

        if (existingIdentity) {
            // Update metadata if provided
            if (metadata && Object.keys(metadata).length > 0) {
                existingIdentity.metadata = { ...existingIdentity.metadata, ...metadata };
                await this.authIdentityRepository.save(existingIdentity);
            }
            return;
        }

        // Create new identity only if it doesn't exist
        const identity = this.authIdentityRepository.create({
            userId,
            provider: this.providerName,
            providerId: providerId,
            metadata: metadata || {},
        });
        await this.authIdentityRepository.save(identity);
    }

    async findIdentityByUserId(userId: string): Promise<NestAuthIdentity | null> {
        return this.authIdentityRepository.findOne({
            where: {
                userId,
                provider: this.providerName,
            },
            relations: ['user'],
        });
    }

    /**
     * Find an existing identity for a provider
     */
    async findIdentity(providerId: string, tenantId?: string): Promise<NestAuthIdentity | null> {
        return this.authIdentityRepository.findOne({
            where: {
                provider: this.providerName,
                providerId: providerId,
                ...(tenantId ? { user: { userAccesses: { tenantId: Equal(tenantId) } } } : {}),
            },
            relations: ['user'],
        });
    }

    /**
     * Resolve the identity that a freshly `validate()`d principal is already
     * linked to (or `null` if this is a first-time login). This is the single
     * seam `AuthService.login` uses after `validate()` to decide "known user vs.
     * create".
     *
     * The default is correct for FIRST-PARTY providers: `validate()` returns our
     * own `NestAuthUser.id`, so we look the identity up by `userId`. SOCIAL /
     * external providers override this to resolve by `providerId`, because their
     * `validate().userId` is the external subject, not our UUID (see
     * `SocialAuthProvider` / `AuthProviderUser.userId`). Keeping the by-userId
     * lookup and the by-providerId lookup in separate, honestly-named methods is
     * deliberate — `findIdentityByUserId` always means "by our user id".
     */
    async findLinkedIdentity(validated: AuthProviderUser): Promise<NestAuthIdentity | null> {
        return this.findIdentityByUserId(validated.userId);
    }

    abstract validate(credentials: NestAuthLoginRequestDto['credentials'], tenantId?: string): Promise<AuthProviderUser | null>;

    abstract getRequiredFields(): string[];


    linkUserWith(): LinkUserWith {
        return 'email';
    }

    /**
     * Optional profile fields a frontend may attach to a social login. Apple only
     * returns the user's name on the FIRST authorization (to the app, never in the
     * id_token afterwards) and never returns an avatar, so the client forwards
     * `firstName` / `lastName` / `avatarUrl` in the credentials. Providers merge
     * the result into their `metadata`; the auth service then uses it when
     * creating the user. Only present keys are copied (never overwrites with
     * `undefined`).
     */
    protected profileOverridesFromCredentials(credentials: any): Record<string, any> {
        const out: Record<string, any> = {};
        if (credentials?.firstName) out.firstName = credentials.firstName;
        if (credentials?.lastName) out.lastName = credentials.lastName;
        if (credentials?.avatarUrl) out.avatarUrl = credentials.avatarUrl;
        return out;
    }
}

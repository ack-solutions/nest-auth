import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthIdentity } from '../../user/entities/identity.entity';
import { BaseAuthProvider } from '../providers/base-auth.provider';
import { EmailAuthProvider } from '../providers/email-auth.provider';
import { PhoneAuthProvider } from '../providers/phone-auth.provider';
import { AppleAuthProvider } from '../providers/apple-auth.provider';
import { GoogleAuthProvider } from '../providers/google-auth.provider';
import { JwtAuthProvider } from '../providers/jwt-auth.provider';
import { FacebookAuthProvider } from '../providers/facebook-auth.provider';
import { GitHubAuthProvider } from '../providers/github-auth.provider';
import { IAuthModuleOptions } from '../interfaces/auth-module-options.interface';
import { AuthConfigService } from './auth-config.service';
import { PasswordlessAuthProvider } from '../providers/passwordless-auth.provider';

@Injectable()
export class AuthProviderRegistryService implements OnModuleInit {
    private providers: Map<string, BaseAuthProvider> = new Map();
    private defaultsRegistered = false;

    /**
     * Live module options — read lazily, never captured. Under forRootAsync the
     * registry is constructed (it lives in CoreModule, an IMPORT of
     * NestAuthModule) before the host module's async options factory runs
     * setOptions(), so a captured value is the package DEFAULTS.
     */
    private get options(): IAuthModuleOptions {
        return AuthConfigService.getOptions();
    }

    constructor(
        private readonly emailAuthProvider: EmailAuthProvider,
        private readonly phoneAuthProvider: PhoneAuthProvider,
        private readonly passwordlessAuthProvider: PasswordlessAuthProvider,
        private readonly jwtAuthProvider: JwtAuthProvider,
        private readonly googleAuthProvider: GoogleAuthProvider,
        private readonly facebookAuthProvider: FacebookAuthProvider,
        private readonly appleAuthProvider: AppleAuthProvider,
        private readonly githubAuthProvider: GitHubAuthProvider,
        @InjectRepository(NestAuthUser)
        private readonly userRepository: Repository<NestAuthUser>,
        @InjectRepository(NestAuthIdentity)
        private readonly authIdentityRepository: Repository<NestAuthIdentity>,
    ) {

        // NOTE: deliberately NOT registering here. Under forRootAsync the async
        // options factory has not run yet, so we would read the defaults and
        // (for example) never register the phone provider. Registration happens
        // in onModuleInit, which Nest runs after every provider — including that
        // factory — has been instantiated.
    }

    onModuleInit(): void {
        this.ensureDefaultsRegistered();
    }

    /**
     * Register the built-in providers exactly once, from the options that are
     * live at the time. Also called defensively from the read accessors so a
     * registry used outside Nest's lifecycle still behaves.
     */
    private ensureDefaultsRegistered(): void {
        if (this.defaultsRegistered) return;
        this.defaultsRegistered = true;
        this.registerDefaultProviders();
    }

    registerDefaultProviders() {
        if (this.options.emailAuth?.enabled) {
            this.registerProvider(this.emailAuthProvider);
        }
        if (this.options.phoneAuth?.enabled) {
            this.registerProvider(this.phoneAuthProvider);
        }
        if (this.options.passwordless?.enabled) {
            this.registerProvider(this.passwordlessAuthProvider);
        }
        // The `'jwt'` login provider trusts any token signed with session.jwt.secret
        // and mints a session for its `sub`. That is a privileged bypass primitive,
        // so it is OPT-IN (previously it was always on whenever session.jwt existed).
        if (this.options.session?.jwt?.enableLoginProvider === true) {
            this.registerProvider(this.jwtAuthProvider);
        }
        if (this.options.google) {
            this.registerProvider(this.googleAuthProvider);
        }
        if (this.options.facebook) {
            this.registerProvider(this.facebookAuthProvider);
        }
        if (this.options.apple) {
            this.registerProvider(this.appleAuthProvider);
        }
        if (this.options.github) {
            this.registerProvider(this.githubAuthProvider);
        }

        // Register custom providers. They're constructed by the consumer (in
        // `customAuthProviders`) without DI access to the repositories the base
        // helpers need, so inject them here before registering — a plain
        // `new MyProvider(opts)` with `forRoot` then works end to end.
        if (this.options.customAuthProviders && Array.isArray(this.options.customAuthProviders)) {
            for (const provider of this.options.customAuthProviders) {
                provider.attachRepositories(this.userRepository, this.authIdentityRepository);
                this.registerProvider(provider);
            }
        }
    }

    /**
     * Register a provider
     */
    registerProvider(provider: BaseAuthProvider): void {
        this.providers.set(provider.providerName, provider);
    }

    /**
     * Get a provider by ID
     */
    getProvider(providerName: string): BaseAuthProvider | undefined {
        this.ensureDefaultsRegistered();
        return this.providers.get(providerName);
    }

    /**
     * Get all registered providers
     */
    getAllProviders(): BaseAuthProvider[] {
        this.ensureDefaultsRegistered();
        return Array.from(this.providers.values());
    }

    /**
     * Get all enabled providers
     */
    getEnabledProviders(): BaseAuthProvider[] {
        return this.getAllProviders().filter(provider =>
            'enabled' in provider ? provider.enabled : true
        );
    }

    /**
     * Check if a provider is registered
     */
    hasProvider(providerName: string): boolean {
        this.ensureDefaultsRegistered();
        return this.providers.has(providerName);
    }
}

import { Injectable, Inject } from '@nestjs/common';
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

@Injectable()
export class AuthProviderRegistryService {
    private providers: Map<string, BaseAuthProvider> = new Map();
    private options: IAuthModuleOptions;

    constructor(
        private readonly emailAuthProvider: EmailAuthProvider,
        private readonly phoneAuthProvider: PhoneAuthProvider,
        private readonly jwtAuthProvider: JwtAuthProvider,
        private readonly googleAuthProvider: GoogleAuthProvider,
        private readonly facebookAuthProvider: FacebookAuthProvider,
        private readonly appleAuthProvider: AppleAuthProvider,
        private readonly githubAuthProvider: GitHubAuthProvider,
    ) {

        this.options = AuthConfigService.getOptions();

        this.registerDefaultProviders();
    }

    registerDefaultProviders() {
        if (this.options.emailAuth?.enabled) {
            this.registerProvider(this.emailAuthProvider);
        }
        if (this.options.phoneAuth?.enabled) {
            this.registerProvider(this.phoneAuthProvider);
        }
        if (this.options.jwt) {
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

        // Register custom providers
        if (this.options.customAuthProviders && Array.isArray(this.options.customAuthProviders)) {
            for (const provider of this.options.customAuthProviders) {
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
        return this.providers.get(providerName);
    }

    /**
     * Get all registered providers
     */
    getAllProviders(): BaseAuthProvider[] {
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
        return this.providers.has(providerName);
    }
}

import { Injectable } from '@nestjs/common';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { TenantService } from '../../tenant/services/tenant.service';
import { ClientConfigResponseDto } from '../dto/responses/client-config.response.dto';

@Injectable()
export class ClientConfigService {
    constructor(
        private readonly authConfig: AuthConfigService,
        private readonly tenantService: TenantService,
    ) { }

    async getClientConfig(): Promise<ClientConfigResponseDto> {
        const config = this.authConfig.getConfig();
        const tenants = await this.fetchTenants();
        const defaultTenantId = await this.resolveDefaultTenantId(config.defaultTenant);

        // Build SSO providers
        const ssoProviders = [];
        if (config.google) {
            const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
            googleAuthUrl.searchParams.set('client_id', config.google.clientId);
            googleAuthUrl.searchParams.set('redirect_uri', config.google.redirectUri);
            googleAuthUrl.searchParams.set('response_type', 'code');
            googleAuthUrl.searchParams.set('scope', 'openid email profile');
            googleAuthUrl.searchParams.set('access_type', 'offline');
            googleAuthUrl.searchParams.set('prompt', 'consent');

            ssoProviders.push({
                id: 'google',
                name: 'Google',
                logoUrl: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg',
                hint: 'Sign in with Google',
                clientId: config.google.clientId,
                authorizationUrl: googleAuthUrl.toString(),
            });
        }
        if (config.facebook) {
            const facebookAuthUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth');
            facebookAuthUrl.searchParams.set('client_id', config.facebook.appId);
            facebookAuthUrl.searchParams.set('redirect_uri', config.facebook.redirectUri);
            facebookAuthUrl.searchParams.set('scope', 'email');
            facebookAuthUrl.searchParams.set('response_type', 'code');

            ssoProviders.push({
                id: 'facebook',
                name: 'Facebook',
                logoUrl: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/facebook.svg',
                hint: 'Sign in with Facebook',
                clientId: config.facebook.appId,
                authorizationUrl: facebookAuthUrl.toString(),
            });
        }
        if (config.apple) {
            ssoProviders.push({
                id: 'apple',
                name: 'Apple',
                logoUrl: undefined,
                hint: 'Sign in with Apple',
            });
        }
        if (config.github) {
            const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
            githubAuthUrl.searchParams.set('client_id', config.github.clientId);
            githubAuthUrl.searchParams.set('redirect_uri', config.github.redirectUri);
            githubAuthUrl.searchParams.set('scope', 'user:email');
            githubAuthUrl.searchParams.set('response_type', 'code');

            ssoProviders.push({
                id: 'github',
                name: 'GitHub',
                logoUrl: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
                hint: 'Sign in with GitHub',
                clientId: config.github.clientId,
                authorizationUrl: githubAuthUrl.toString(),
            });
        }

        // Build default config
        const defaultConfig: ClientConfigResponseDto = {
            emailAuth: {
                enabled: config.emailAuth?.enabled ?? false,
            },
            phoneAuth: {
                enabled: config.phoneAuth?.enabled ?? false,
            },
            registration: {
                enabled: config.registration?.enabled !== false, // Default to true unless explicitly disabled
                requireInvitation: config.registration?.requireInvitation ?? false,
                collectProfileFields: config.registration?.collectProfileFields,
            },
            mfa: {
                enabled: config.mfa?.enabled ?? false,
                methods: config.mfa?.methods?.map((m) => m.toString()) ?? [],
                allowUserToggle: config.mfa?.allowUserToggle ?? true,
                allowMethodSelection: config.mfa?.allowMethodSelection ?? true,
            },
            tenants: {
                mode: config.defaultTenant ? 'single' : 'multi',
                defaultTenantId,
                options: tenants,
            },
            sso: {
                enabled: Boolean(config.google || config.facebook || config.apple || config.github),
                providers: ssoProviders,
            },
        };

        // Allow customization via factory function
        if (config.clientConfig?.factory) {
            const customized = await config.clientConfig.factory(defaultConfig, {
                configService: this.authConfig,
                tenantService: this.tenantService,
            });
            return customized ?? defaultConfig;
        }

        return defaultConfig;
    }

    private async fetchTenants(): Promise<Array<{ id: string; name: string; slug: string; isActive: boolean; metadata?: Record<string, any> }>> {
        try {
            const tenants = await this.tenantService.getTenants({
                select: ['id', 'name', 'slug', 'metadata', 'isActive'],
                order: { name: 'ASC' },
            });

            return tenants.map((tenant) => ({
                id: tenant.id,
                name: tenant.name,
                slug: tenant.slug,
                metadata: tenant.metadata ?? {},
                isActive: tenant.isActive,
            }));
        } catch (error) {
            // Return empty array if tenant service fails (e.g., in single-tenant mode)
            return [];
        }
    }

    private async resolveDefaultTenantId(
        options?: { slug?: string },
    ): Promise<string | null> {
        if (!options?.slug) {
            return null;
        }

        try {
            const tenant = await this.tenantService.getTenantBySlug(options.slug);
            return tenant?.id ?? null;
        } catch (error) {
            return null;
        }
    }
}

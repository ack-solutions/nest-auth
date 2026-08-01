import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GITHUB_AUTH_PROVIDER } from '../../auth.constants';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthIdentity } from '../../user/entities/identity.entity';
import { IAuthModuleOptions } from '../interfaces/auth-module-options.interface';
import { BaseAuthProvider } from './base-auth.provider';
import { SocialCredentialsDto } from '../../auth/dto/credentials/social-credentials.dto';

@Injectable()
export class GitHubAuthProvider extends BaseAuthProvider {
    providerName = GITHUB_AUTH_PROVIDER;
    private githubConfig: IAuthModuleOptions['github'];

    constructor(
        @InjectRepository(NestAuthUser)
        protected readonly userRepository: Repository<NestAuthUser>,
        @InjectRepository(NestAuthIdentity)
        protected readonly authIdentityRepository: Repository<NestAuthIdentity>,
    ) {
        super(userRepository, authIdentityRepository);

        this.githubConfig = this.options.github;
        this.enabled = Boolean(this.githubConfig);
    }

    private get userApiUrl(): string {
        return this.githubConfig?.userApiUrl || 'https://api.github.com/user';
    }

    private get emailsApiUrl(): string {
        return this.githubConfig?.emailsApiUrl || 'https://api.github.com/user/emails';
    }

    async validate(credentials: SocialCredentialsDto, _tenantId?: string) {
        let userResponse: Response;
        try {
            // Fetch user info from GitHub API (URL configurable for Enterprise/proxy/tests)
            userResponse = await fetch(this.userApiUrl, {
                headers: {
                    Authorization: `Bearer ${credentials.token}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            });
        } catch (error) {
            // Network / DNS failure reaching GitHub — distinct from a bad token.
            throw new UnauthorizedException({
                code: 'OAUTH_PROVIDER_ERROR',
                message: 'Could not reach GitHub. Try again in a moment.',
            });
        }

        if (userResponse.status === 401 || userResponse.status === 403) {
            // Token was rejected by GitHub.
            throw new UnauthorizedException({
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid GitHub token.',
            });
        }

        if (!userResponse.ok) {
            // 5xx or other upstream issue.
            throw new UnauthorizedException({
                code: 'OAUTH_PROVIDER_ERROR',
                message: 'GitHub returned an unexpected response.',
            });
        }

        let userData: any;
        try {
            userData = await userResponse.json();
        } catch (error) {
            throw new UnauthorizedException({
                code: 'OAUTH_PROVIDER_ERROR',
                message: 'GitHub returned a malformed response.',
            });
        }

        // Fetch user emails (in case email is private in profile).
        let email = userData.email;
        let emailVerified = false;
        if (!email) {
            try {
                const emailsResponse = await fetch(this.emailsApiUrl, {
                    headers: {
                        Authorization: `Bearer ${credentials.token}`,
                        Accept: 'application/vnd.github.v3+json',
                    },
                });

                if (emailsResponse.ok) {
                    const emails: any = await emailsResponse.json();
                    // Prefer a verified primary, then any verified, then primary, then anything.
                    const chosen =
                        emails.find((e: any) => e.primary && e.verified) ||
                        emails.find((e: any) => e.verified) ||
                        emails.find((e: any) => e.primary) ||
                        emails[0];
                    email = chosen?.email || '';
                    emailVerified = chosen?.verified === true;
                }
            } catch (error) {
                // Fall through — handled by the no-email check below.
            }
        } else {
            // GitHub returns `email` directly on the profile only when the user
            // has set it to public — a public email on GitHub is by definition
            // a verified one (you can't make an unverified email public).
            emailVerified = true;
        }

        if (!email) {
            // The token was valid but no usable email could be obtained — most
            // commonly because the user's GitHub email is set to private and
            // the token wasn't issued with the `user:email` scope.
            throw new UnauthorizedException({
                code: 'OAUTH_EMAIL_NOT_PUBLIC',
                message:
                    'Your GitHub email is not publicly visible. ' +
                    'Either make your primary email public on GitHub, grant the user:email scope, ' +
                    'or sign in with a different method.',
            });
        }

        return {
            userId: userData.id.toString(),
            email,
            emailVerified,
            metadata: {
                name: userData.name || userData.login,
                login: userData.login,
                avatar: userData.avatar_url,
                bio: userData.bio,
                company: userData.company,
                location: userData.location,
                ...this.profileOverridesFromCredentials(credentials),
            },
        };
    }

    getRequiredFields(): string[] {
        return ['token'];
    }
}

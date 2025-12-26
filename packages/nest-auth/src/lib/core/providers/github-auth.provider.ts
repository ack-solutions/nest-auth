import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GITHUB_AUTH_PROVIDER } from '../../auth.constants';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthIdentity } from '../../user/entities/identity.entity';
import { IAuthModuleOptions } from '../interfaces/auth-module-options.interface';
import { BaseAuthProvider } from './base-auth.provider';
import { SocialCredentialsDto } from 'src/lib/auth';

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

    async validate(credentials: SocialCredentialsDto) {
        try {
            // Fetch user info from GitHub API
            const userResponse = await fetch('https://api.github.com/user', {
                headers: {
                    Authorization: `Bearer ${credentials.token}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            });

            if (!userResponse.ok) {
                throw new UnauthorizedException('Invalid GitHub token');
            }

            const userData: any = await userResponse.json();

            // Fetch user emails (in case email is private in profile)
            let email = userData.email;
            if (!email) {
                const emailsResponse = await fetch('https://api.github.com/user/emails', {
                    headers: {
                        Authorization: `Bearer ${credentials.token}`,
                        Accept: 'application/vnd.github.v3+json',
                    },
                });

                if (emailsResponse.ok) {
                    const emails: any = await emailsResponse.json();
                    const primaryEmail = emails.find((e: any) => e.primary) || emails[0];
                    email = primaryEmail?.email || '';
                }
            }

            return {
                userId: userData.id.toString(),
                email: email || '',
                metadata: {
                    name: userData.name || userData.login,
                    login: userData.login,
                    avatar: userData.avatar_url,
                    bio: userData.bio,
                    company: userData.company,
                    location: userData.location,
                },
            };
        } catch (error) {
            throw new UnauthorizedException('Invalid GitHub token');
        }
    }

    getRequiredFields(): string[] {
        return ['token'];
    }
}

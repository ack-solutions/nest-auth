import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Equal, IsNull, Repository } from 'typeorm';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthUserAccess } from '../../user/entities/user-access.entity';
import { NestAuthPlatformAccess } from '../../user/entities/platform-access.entity';
import { NestAuthSession } from '../../session/entities/session.entity';
import { JwtService } from '../../core/services/jwt.service';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { UserService } from '../../user/services/user.service';
import { TenantService } from '../../tenant/services/tenant.service';
import { MfaService } from './mfa.service';
import { SessionManagerService } from '../../session/services/session-manager.service';
import { hmacSha256Hex } from '../../utils/has-token';
import { JWTTokenPayload, SessionPayload } from '../../core/interfaces/token-payload.interface';
import { AuthResponseDto, AuthTokensResponseDto } from '../dto/responses/auth.response.dto';

/**
 * Shared session/token/response helpers extracted from the (formerly 1226-LOC)
 * AuthService as part of the Phase-2 god-service split (T-040..T-047, task #11).
 *
 * Owning these here lets SignupService / LoginService / RefreshService each
 * depend on a single small service instead of all living inside AuthService.
 * AuthService keeps thin delegating facades so its public API is unchanged.
 *
 * No circular dependencies: this service depends on user/tenant/mfa services,
 * none of which depend back on AuthService or this service.
 */
@Injectable()
export class SessionTokenService {
    constructor(
        @InjectRepository(NestAuthUser)
        private readonly userRepository: Repository<NestAuthUser>,
        private readonly jwtService: JwtService,
        private readonly authConfigService: AuthConfigService,
        private readonly userService: UserService,
        private readonly tenantService: TenantService,
        private readonly mfaService: MfaService,
        private readonly sessionManager: SessionManagerService,
    ) {}

    /** Secret used to HMAC-hash refresh tokens for rotation/reuse detection. */
    private getRefreshHashSecret(): string {
        return this.authConfigService.getConfig().session?.jwt?.secret ?? '';
    }

    getUserWithRoles(userId: string, relations: string[] = []): Promise<NestAuthUser> {
        return this.userRepository.findOne({
            where: { id: userId },
            relations: ['userAccesses', 'userAccesses.roles', ...relations],
        });
    }

    async getUserWithAccess(
        userId: string,
        tenantId: string,
        isPlatformAccess = false,
    ): Promise<{ user: NestAuthUser; userAccess?: NestAuthUserAccess; platformAccess?: NestAuthPlatformAccess }> {
        const user = await this.userRepository.findOne({
            where: {
                id: userId,
                ...(tenantId ? { userAccesses: { tenantId } } : {}),
            },
        });
        if (isPlatformAccess) {
            const platformAccess = await NestAuthPlatformAccess.findOne({
                where: { userId, isActive: true },
                relations: ['roles', 'roles.rolePermissions', 'roles.rolePermissions.permission'],
            });
            return { user, platformAccess };
        }
        const userAccess = await NestAuthUserAccess.findOne({
            where: {
                userId,
                isActive: true,
                tenantId: tenantId ? Equal(tenantId) : IsNull(),
            },
            relations: ['roles', 'roles.rolePermissions', 'roles.rolePermissions.permission'],
        });

        return { user, userAccess };
    }

    async generateTokensPayload(
        session: SessionPayload,
        otherPayload: Partial<JWTTokenPayload> = {},
    ): Promise<JWTTokenPayload> {
        let payload: JWTTokenPayload = {
            id: session.userId,
            sub: session.userId,
            sessionId: session.id,
            email: session.data?.user?.email,
            phone: session.data?.user?.phone,
            emailVerifiedAt: session.data?.user?.emailVerifiedAt,
            phoneVerifiedAt: session.data?.user?.phoneVerifiedAt,
            roles: session.data?.roles || [],
            tenantId: session.data?.tenantId,
            isMfaEnabled: session.data?.user?.isMfaEnabled,
            isMfaVerified: session.data?.isMfaVerified,
            ...otherPayload,
        };

        // Apply custom token payload hook if configured
        const config = this.authConfigService.getConfig();
        if (config.session?.customizeTokenPayload) {
            payload = await config.session.customizeTokenPayload(payload, session);
        }

        return payload;
    }

    async generateTokensFromSession(session: NestAuthSession): Promise<AuthTokensResponseDto> {
        const payload = await this.generateTokensPayload(session as unknown as SessionPayload);
        const tokens = await this.jwtService.generateTokens(payload);

        // Rotation: persist a hash of the just-issued refresh token on the
        // session. A later refresh re-hashes the presented token and compares —
        // so an old (already-rotated) refresh token is rejected. Awaited so we
        // never hand out a refresh token whose hash we failed to record.
        if (session?.id && tokens.refreshToken) {
            await this.sessionManager.updateSession(session.id, {
                refreshToken: hmacSha256Hex(this.getRefreshHashSecret(), tokens.refreshToken),
            });
        }

        return tokens;
    }

    async generateAuthResponse(
        user: NestAuthUser,
        session: any, // NestAuthSession
        tokens: { accessToken: string; refreshToken: string },
        isRequiresMfa: boolean,
        trustToken?: string,
    ): Promise<AuthResponseDto> {
        const config = this.authConfigService.getConfig();

        const activeTenantId = session?.data?.tenantId;
        let tenants = await this.userService.getUserTenants(user.id);
        if (!tenants.length && activeTenantId) {
            const fallbackTenant = await this.tenantService.getTenantById(activeTenantId);
            if (fallbackTenant) {
                tenants = [fallbackTenant];
            }
        }

        let response: AuthResponseDto = {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            isRequiresMfa: isRequiresMfa,
        };

        if (isRequiresMfa) {
            const enabledMethods = await this.mfaService.getEnabledMethods(user.id);
            response.mfaMethods = enabledMethods;
            response.defaultMfaMethod = this.mfaService.mfaConfig?.defaultMethod || enabledMethods[0];
        }

        if (config.auth?.transformResponse) {
            response = await config.auth.transformResponse(response, user, session);
        }

        if (trustToken) {
            response.trustToken = trustToken;
        }

        return response;
    }
}

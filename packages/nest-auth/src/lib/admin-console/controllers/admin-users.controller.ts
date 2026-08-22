import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseFilters,
} from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { AdminSessionGuard } from '../guards/admin-session.guard';
import { AuthExceptionFilter } from '../../auth/filters/auth-exception.filter';
import { ApiTags, ApiCookieAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ApiUnauthorized, ApiForbidden, ApiValidationError, ApiNotFoundError, Public } from '../../core';
import { AdminCreateUserDto, AdminUpdateUserDto } from '../dto/admin-user.dto';
import { UserService } from '../../user/services/user.service';
import { AdminUserManagementService } from '../services/admin-user-management.service';
import { TenantService } from '../../tenant/services/tenant.service';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthMFASecret } from '../../auth/entities/mfa-secret.entity';
import { EMAIL_AUTH_PROVIDER, PHONE_AUTH_PROVIDER } from '../../auth.constants';
import { FindOptionsWhere, Like } from 'typeorm';
import { MfaService } from '../../auth/services/mfa.service';
import { SessionManagerService } from '../../session/services/session-manager.service';
import { NestAuthSession } from '../../session/entities/session.entity';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { NestAuthUserAccess } from '../../user/entities/user-access.entity';
import { NestAuthPlatformAccess } from '../../user/entities/platform-access.entity';
import { TenantModeEnum, NestAuthUserAccessStatusEnum } from '@ackplus/nest-auth-contracts';
import { mapRoleToResponse } from '../../role/utils/role-mapper.util';
import { NestAuthTrustedDevice } from '../../auth/entities/trusted-device.entity';

/**
 * Relations needed to hydrate a user's TENANT access scope (`userAccesses`) —
 * one row per tenant, each carrying its own roles.
 */
const TENANT_ACCESS_RELATIONS = [
  'userAccesses',
  'userAccesses.tenant',
  'userAccesses.roles',
  'userAccesses.roles.rolePermissions',
  'userAccesses.roles.rolePermissions.permission',
];

/**
 * Relations needed to hydrate a user's PLATFORM access scope (`platformAccess`)
 * — a tenant-less 1:1 marker carrying platform-wide roles. Independent of
 * `TENANT_ACCESS_RELATIONS`: a user may hold both, either, or neither.
 */
const PLATFORM_ACCESS_RELATIONS = [
  'platformAccess',
  'platformAccess.roles',
  'platformAccess.roles.rolePermissions',
  'platformAccess.roles.rolePermissions.permission',
];

const ALL_ACCESS_RELATIONS = [...TENANT_ACCESS_RELATIONS, ...PLATFORM_ACCESS_RELATIONS];

/** `?scope=` values for the user list. */
type UserListScope = 'all' | 'platform' | 'tenant';

@Controller('api/users')
@UseFilters(AuthExceptionFilter)
@UseGuards(AdminSessionGuard)
@ApiTags('Admin · Users')
@ApiCookieAuth('admin-session')
@ApiUnauthorized('Admin session missing or invalid.')
@ApiForbidden()
@ApiValidationError()
@ApiNotFoundError('User not found.')
@Public() // exempt from a consumer's global APP_GUARD; AdminSessionGuard is the real guard
export class AdminUsersController {
  constructor(
    private readonly users: UserService,
    private readonly adminUserManagement: AdminUserManagementService,
    private readonly tenantService: TenantService,
    private readonly authConfigService: AuthConfigService,
    private readonly mfaService: MfaService,
    private readonly sessionManager: SessionManagerService,
    @InjectRepository(NestAuthMFASecret)
    private readonly mfaSecretRepository: Repository<NestAuthMFASecret>,
    @InjectRepository(NestAuthUserAccess)
    private readonly userAccessRepository: Repository<NestAuthUserAccess>,
    @InjectRepository(NestAuthTrustedDevice)
    private readonly trustedDeviceRepository: Repository<NestAuthTrustedDevice>,
    @InjectRepository(NestAuthPlatformAccess)
    private readonly platformAccessRepository: Repository<NestAuthPlatformAccess>,
  ) { }

  private async ensureUserExists(id: string): Promise<NestAuthUser> {
    const user = await this.users.getUserById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private toSessionResponse(session: NestAuthSession) {
    return {
      id: session.id,
      userId: session.userId,
      deviceName: session.deviceName || 'Unknown device',
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      lastActive: session.lastActive,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    };
  }

  private buildStatusFilter(status?: string): Partial<FindOptionsWhere<NestAuthUser>> {
    if (!status) return {};
    switch (status) {
      case 'active':
        return { isActive: true };
      case 'inactive':
        return { isActive: false };
      case 'verified':
        return { emailVerifiedAt: Not(IsNull()) };
      case 'unverified':
        return { emailVerifiedAt: IsNull() };
      default:
        return {};
    }
  }

  private escapeLikePattern(value: string): string {
    return value.replace(/[%_\\]/g, '\\$&');
  }


  private async resolveTenantIds(tenantIds: string[] = []): Promise<string[]> {
    if (!tenantIds.length) {
      return [];
    }
    const resolved = await Promise.all(
      tenantIds.map((id) => this.tenantService.resolveTenantId(id))
    );
    const resolvedSet = Array.from(new Set(resolved.filter(Boolean))) as string[];
    const unresolved = tenantIds.filter((id, i) => !resolved[i]);
    if (unresolved.length > 0) {
      throw new BadRequestException(
        `Invalid or unresolved tenant ID(s): ${unresolved.join(', ')}`
      );
    }
    return resolvedSet;
  }

  @ApiOperation({ summary: 'List users (paginated, cross-tenant; filter by scope/status/tenant/role/search)' })
  @ApiQuery({
    name: 'scope',
    required: false,
    enum: ['all', 'platform', 'tenant'],
    description:
      'Access scope. `all` (default) lists every user; `platform` lists only ' +
      'platform (super-admin) users — those holding a `NestAuthPlatformAccess` ' +
      'marker; `tenant` lists only users WITHOUT that marker. The two scopes are ' +
      'independent, so a user may hold both.',
  })
  @Get()
  async listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('tenantId') tenantId?: string,
    @Query('roleName') roleName?: string,
    @Query('scope') scope?: string,
  ) {
    const resolvedScope = this.resolveScope(scope);
    // Validate and sanitize pagination parameters
    let pageNum = parseInt(page || '1', 10);
    let limitNum = parseInt(limit || '10', 10);

    // Ensure page is at least 1
    if (isNaN(pageNum) || pageNum < 1) {
      pageNum = 1;
    }

    // Ensure limit is positive and capped at 100
    if (isNaN(limitNum) || limitNum <= 0) {
      limitNum = 10;
    }
    if (limitNum > 100) {
      limitNum = 100;
    }

    const skip = (pageNum - 1) * limitNum;

    // Build base filter with status and tenant
    const baseFilter: FindOptionsWhere<NestAuthUser> = {
      ...this.buildStatusFilter(status),
    };

    // Add tenant filter if provided (same table structure for isolated and shared: filter by userAccesses)
    if (tenantId && tenantId.trim()) {
      baseFilter.userAccesses = { tenantId: tenantId.trim() };
    }

    // Add role filter if provided
    if (roleName && roleName.trim()) {
      (baseFilter as any).roles = { name: roleName.trim() };
    }

    // `scope=tenant` excludes platform users. (`scope=platform` is handled by
    // UserService.getPlatformUsersAndCount below, which owns the marker filter.)
    if (resolvedScope === 'tenant') {
      baseFilter.platformAccess = { id: IsNull() } as FindOptionsWhere<NestAuthPlatformAccess>;
    }

    // Build where clause with proper TypeORM typing
    let where: FindOptionsWhere<NestAuthUser>[] | FindOptionsWhere<NestAuthUser> = baseFilter;

    // Apply search filter with proper OR conditions using array syntax
    if (search && search.trim()) {
      const escapedSearch = this.escapeLikePattern(search.trim());
      const searchPattern = `%${escapedSearch}%`;

      // Create OR conditions for search
      // Note: Only search on text columns (email, phone)
      // tenantId is UUID type and doesn't support LIKE operator
      where = [
        { ...baseFilter, email: Like(searchPattern) },
        { ...baseFilter, phone: Like(searchPattern) },
      ];
    }

    const findOptions = {
      where,
      // Always hydrate BOTH access scopes so the list can show which users hold
      // platform access alongside their tenant memberships.
      relations: ALL_ACCESS_RELATIONS,
      order: { createdAt: 'DESC' as const },
      skip,
      take: limitNum,
    };

    // Get users and total count in a single query. `scope=platform` routes
    // through the service helper that owns the platform-marker filter (and
    // paginates correctly across the 1:1 join).
    const [users, total] =
      resolvedScope === 'platform'
        ? await this.users.getPlatformUsersAndCount(findOptions)
        : await this.users.getUsersAndCount(findOptions);

    const safeUsers = await Promise.all(users.map((user) => this.toSafeUser(user)));

    return {
      data: safeUsers,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        scope: resolvedScope,
      },
    };
  }

  /**
   * Platform access must be switched on in the module config before the console
   * can hand it out — otherwise we'd write markers the login path never reads.
   */
  private assertPlatformAccessEnabled(): void {
    if (this.authConfigService.getConfig().platformAccess?.enabled !== true) {
      throw new BadRequestException({
        message:
          'Platform access is disabled. Set `platformAccess.enabled: true` in the ' +
          'NestAuthModule config to manage platform users.',
        code: 'PLATFORM_ACCESS_DISABLED',
      });
    }
  }

  /** Normalize `?scope=`; anything unrecognized falls back to `all`. */
  private resolveScope(scope?: string): UserListScope {
    const normalized = scope?.trim().toLowerCase();
    return normalized === 'platform' || normalized === 'tenant' ? normalized : 'all';
  }

  @ApiOperation({ summary: 'Create a user' })
  @Post()
  async createUser(@Body() dto: AdminCreateUserDto) {
    const config = this.authConfigService.getConfig();
    const tenantEnabled = config.tenant?.enabled === true;
    const tenantMode = config.tenant?.mode ?? TenantModeEnum.ISOLATED;

    // PLATFORM user — tenant-less by definition, so it bypasses the tenant
    // requirement entirely and is provisioned with its marker atomically.
    if (dto.isPlatformUser) {
      this.assertPlatformAccessEnabled();
      const platformUser = await this.users.createPlatformUser({
        email: dto.email,
        phone: dto.phone,
        metadata: dto.metadata ?? {},
        isActive: dto.isActive ?? true,
        emailVerifiedAt: dto.emailVerifiedAt ?? null,
        phoneVerifiedAt: dto.phoneVerifiedAt ?? null,
      });
      const reloaded = await this.users.getUserById(platformUser.id, {
        relations: ALL_ACCESS_RELATIONS,
      });
      return { user: await this.toSafeUser(reloaded) };
    }

    let tenantId: string | undefined;
    if (tenantEnabled && tenantMode === TenantModeEnum.ISOLATED) {
      if (!dto.tenantId?.trim()) {
        throw new BadRequestException('tenantId is required when tenant mode is isolated');
      }
      const tenant = await this.tenantService.getTenantById(dto.tenantId.trim());
      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }
      tenantId = dto.tenantId.trim();
    }
    // SHARED or tenant disabled: no tenantId at create; assign tenant/roles in edit

    const user = await this.users.createUser(
      {
        email: dto.email,
        phone: dto.phone,
        metadata: dto.metadata ?? {},
        isActive: dto.isActive ?? true,
        emailVerifiedAt: dto.emailVerifiedAt ?? null,
        phoneVerifiedAt: dto.phoneVerifiedAt ?? null,
      },
      tenantId
    );

    const safeUser = await this.toSafeUser(user);
    return { user: safeUser };
  }

  @ApiOperation({ summary: 'Get a user (with roles, sessions, identities)' })
  @Get(':id')
  async getUser(@Param('id') id: string) {
    const user = await this.users.getUserById(id, {
      relations: ['mfaSecrets', 'identities', ...ALL_ACCESS_RELATIONS],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const config = this.authConfigService.getConfig();
    const emailAuthEnabled = config.emailAuth?.enabled !== false;
    const phoneAuthEnabled = config.phoneAuth?.enabled === true;
    const passwordlessEnabled = config.passwordless?.enabled === true;

    const identities = (user.identities ?? []);
    const hasEmailIdentity = (user.identities ?? []).some(
      (i) => i.provider === EMAIL_AUTH_PROVIDER && i.providerId === user.email
    );
    const hasPhoneIdentity = (user.identities ?? []).some(
      (i) => i.provider === PHONE_AUTH_PROVIDER && i.providerId === user.phone
    );

    const socialProviders = [
      config.google?.clientId ? 'google' : null,
      config.github?.clientId ? 'github' : null,
      config.facebook?.appId ? 'facebook' : null,
      config.apple?.clientId ? 'apple' : null,
    ].filter(Boolean) as string[];

    const socialIdentities = (user.identities ?? [])
      .filter((i) => ![EMAIL_AUTH_PROVIDER, PHONE_AUTH_PROVIDER].includes(i.provider))
      .map((i) => i.provider);

    const availableMethods = this.mfaService.getAvailableMethods();
    const enabledMethods = await this.mfaService.getEnabledMethods(user.id);
    const sessions = await this.sessionManager.getUserSessions(user.id);

    const sortedSessions = sessions
      .sort((a, b) => {
        const aTime = a.lastActive?.getTime() ?? a.updatedAt?.getTime() ?? 0;
        const bTime = b.lastActive?.getTime() ?? b.updatedAt?.getTime() ?? 0;
        return bTime - aTime;
      })
      .map((session) => this.toSessionResponse(session));

    const safeUser = await this.toSafeUser(user);

    const trustedDevices = await this.trustedDeviceRepository.find({
      where: { userId: user.id },
      order: { lastUsedAt: 'DESC', createdAt: 'DESC' } as any,
      take: 50,
    });

    const mfaEnabledForApp = config.mfa?.enabled === true;
    const mfaRequiredForAll = config.mfa?.required === true;
    const mfaRequiredForUser = mfaEnabledForApp && (mfaRequiredForAll || user.isMfaEnabled === true);

    return {
      user: safeUser,
      identities,
      trustedDevices: trustedDevices,
      loginCapabilities: {
        // Config + identity-derived capabilities (more accurate than the legacy booleans)
        email: {
          enabledInConfig: emailAuthEnabled,
          hasIdentity: hasEmailIdentity,
          verified: !!user.emailVerifiedAt,
          canPasswordLogin: emailAuthEnabled  && hasEmailIdentity && !!user.passwordHash,
          canOtpLogin: emailAuthEnabled && passwordlessEnabled && hasEmailIdentity,
        },
        phone: {
          enabledInConfig: phoneAuthEnabled,
          hasIdentity: hasPhoneIdentity,
          canPasswordLogin: phoneAuthEnabled && hasPhoneIdentity && !!user.passwordHash,
          verified: !!user.phoneVerifiedAt,
          canOtpLogin: phoneAuthEnabled && passwordlessEnabled && hasPhoneIdentity,
        },
        passwordless: {
          enabledInConfig: passwordlessEnabled,
          allowSignUp: config.passwordless?.allowSignUp === true,
        },
        social: {
          enabledProviders: socialProviders,
          identityProviders: Array.from(new Set(socialIdentities)),
        },
        mfa: {
          enabledInConfig: mfaEnabledForApp,
          requiredForAll: mfaRequiredForAll,
          requiredForUser: mfaRequiredForUser,
        },
      },
      mfa: {
        isEnabled: user.isMfaEnabled,
        allowUserToggle: this.mfaService.mfaConfig?.allowUserToggle ?? false,
        availableMethods,
        enabledMethods,
        hasRecoveryCode: !!user.mfaRecoveryCode,
        totpDevices: user.mfaSecrets?.map((device) => ({
          id: device.id,
          deviceName: device.deviceName || 'Authenticator',
          verified: device.verified,
          lastUsedAt: device.lastUsedAt,
          createdAt: device.createdAt,
        })) || [],
      },
      sessions: sortedSessions,
    };
  }

  @ApiOperation({ summary: 'Update a user' })
  @Patch(':id')
  async updateUser(@Param('id') id: string, @Body() dto: AdminUpdateUserDto) {
    let user = await this.users.getUserById(id, {
      relations: ['identities', ...ALL_ACCESS_RELATIONS],
    });
    if (!user) {
      throw new NotFoundException('User not found');  
    }

    const oldEmail = user.email;
    const oldPhone = user.phone;

    // Apply basic field updates if provided (including email and phone)
    if (dto.isActive !== undefined || dto.emailVerifiedAt !== undefined || dto.phoneVerifiedAt !== undefined || dto.metadata !== undefined ||
      dto.isMfaEnabled !== undefined || dto.email !== undefined || dto.phone !== undefined) {
      const updates: Partial<NestAuthUser> = {};
      if (dto.isActive !== undefined) updates.isActive = dto.isActive;
      if (dto.emailVerifiedAt !== undefined) updates.emailVerifiedAt = dto.emailVerifiedAt;
      if (dto.phoneVerifiedAt !== undefined) updates.phoneVerifiedAt = dto.phoneVerifiedAt;
      if (dto.metadata !== undefined) updates.metadata = dto.metadata;
      if (dto.isMfaEnabled !== undefined) updates.isMfaEnabled = dto.isMfaEnabled;
      if (dto.email !== undefined) updates.email = dto.email;
      if (dto.phone !== undefined) updates.phone = dto.phone;

      user = await this.users.updateUser(id, updates);
    }

    // Handle email change - update or create identity if email changed
    if (dto.email !== undefined && dto.email !== oldEmail) {
      // Remove old email identity if it exists
      if (oldEmail) {
        const oldEmailIdentity = user.identities?.find(i =>
          i.provider === EMAIL_AUTH_PROVIDER && i.providerId === oldEmail
        );
        if (oldEmailIdentity) {
          await oldEmailIdentity.remove();
        }
      }
      // Create new email identity if email is set and email login is enabled
      if (dto.email && user.emailVerifiedAt) {
        await user.findOrCreateIdentity(EMAIL_AUTH_PROVIDER, dto.email);
      }
    }

    // Handle phone change - update or create identity if phone changed
    if (dto.phone !== undefined && dto.phone !== oldPhone) {
      // Remove old phone identity if it exists
      if (oldPhone) {
        const oldPhoneIdentity = user.identities?.find(i =>
          i.provider === PHONE_AUTH_PROVIDER && i.providerId === oldPhone
        );
        if (oldPhoneIdentity) {
          await oldPhoneIdentity.remove();
        }
      }
      // Create new phone identity if phone is set and phone login is enabled
      if (dto.phone && user.phoneVerifiedAt) {
        await user.findOrCreateIdentity(PHONE_AUTH_PROVIDER, dto.phone);
      }
    }

    // Enable/disable email login
    if (dto.emailLoginEnabled !== undefined) {
      if (dto.emailLoginEnabled) {
        if (!user.email) {
          throw new NotFoundException('User has no email address');
        }
        user.emailVerifiedAt = user.emailVerifiedAt || new Date();
        // Ensure identity exists with current email
        await user.findOrCreateIdentity(EMAIL_AUTH_PROVIDER, user.email);
      } else {
        user.emailVerifiedAt = null;
        // Remove email identity if exists
        const emailIdentity = user.identities?.find(i => i.provider === EMAIL_AUTH_PROVIDER);
        if (emailIdentity) {
          await emailIdentity.remove();
        }
      }
    }

    // Enable/disable phone login
    if (dto.phoneLoginEnabled !== undefined) {
      if (dto.phoneLoginEnabled) {
        if (!user.phone) {
          throw new NotFoundException('User has no phone number');
        }
        user.phoneVerifiedAt = user.phoneVerifiedAt || new Date();
        // Ensure identity exists with current phone
        await user.findOrCreateIdentity(PHONE_AUTH_PROVIDER, user.phone);
      } else {
        user.phoneVerifiedAt = null;
        // Remove phone identity if exists
        const phoneIdentity = user.identities?.find(i => i.provider === PHONE_AUTH_PROVIDER);
        if (phoneIdentity) {
          await phoneIdentity.remove();
        }
      }
    }

    // Apply password change in-memory
    if (dto.password) {
      await user.setPassword(dto.password);
    }

    // Save all changes
    await user.save();

    const config = this.authConfigService.getConfig();
    const tenantEnabled = config.tenant?.enabled === true;
    const tenantMode = config.tenant?.mode ?? TenantModeEnum.ISOLATED;

    // SHARED mode only: sync tenant memberships (add/remove tenants)
    if (tenantEnabled && tenantMode === TenantModeEnum.SHARED && dto.tenantIds !== undefined) {
      const resolvedIds = await this.resolveTenantIds(dto.tenantIds);
      await this.adminUserManagement.syncUserAccesses(id, resolvedIds);
    }

    // Tenants disabled: set global roles (stored on access with tenantId = NULL)
    if (!tenantEnabled && dto.roleIds !== undefined) {
      const userAccess = await user.getUserAccess(null, true);
      await userAccess.assignRoles(dto.roleIds ?? []);
    }

    // Set roles per tenant (both SHARED and ISOLATED)
    if (dto.tenantRoles?.length) {
      for (const tr of dto.tenantRoles) {
        const resolved = await this.resolveTenantIds([tr.tenantId]);
        if (resolved.length) {
          await this.users.setUserAccessRoles(id, tr.tenantId, tr.roleIds ?? []);
        }
      }
    }

    // Grant / revoke PLATFORM access. Runs BEFORE the role assignment below so
    // one request can both grant access and set the platform roles.
    if (dto.isPlatformUser !== undefined) {
      this.assertPlatformAccessEnabled();
      const existingAccess = await user.getPlatformAccess(false);
      if (dto.isPlatformUser) {
        // Idempotent — getPlatformAccess(true) returns the existing row or creates one.
        await user.getPlatformAccess(true);
      } else if (existingAccess) {
        // Dropping the marker also drops its platform roles (the join rows
        // cascade). Tenant memberships and their roles are untouched.
        await this.platformAccessRepository.remove(existingAccess);
      }
    }

    // Set PLATFORM roles — a scope of its own, stored on the platform-access row
    // rather than on any tenant access. Requires the user to hold platform
    // access (grant it in the same request via `isPlatformUser: true`).
    if (dto.platformRoleIds !== undefined) {
      const platformAccess = await user.getPlatformAccess(false);
      if (!platformAccess) {
        throw new BadRequestException({
          message:
            'User is not a platform user. Grant platform access first ' +
            '(send `isPlatformUser: true`) before assigning platform roles.',
          code: 'NOT_PLATFORM_USER',
        });
      }
      await platformAccess.assignRoles(dto.platformRoleIds ?? []);
    }

    // Reload user with fresh memberships (both access scopes)
    const reloadedUser = await this.users.getUserById(user.id, {
      relations: ALL_ACCESS_RELATIONS,
    });
    const safeUser = await this.toSafeUser(reloadedUser);
    return { user: safeUser };
  }

  @ApiOperation({ summary: "Remove a user's TOTP device" })
  @Delete(':id/totp-devices/:deviceId')
  async deleteTotpDevice(@Param('id') id: string, @Param('deviceId') deviceId: string) {
    const user = await this.users.getUserById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const device = await this.mfaSecretRepository.findOne({
      where: { id: deviceId, userId: user.id },
    });

    if (!device) {
      throw new NotFoundException('TOTP device not found');
    }

    await this.mfaSecretRepository.remove(device);
    return { message: 'TOTP device deleted successfully' };
  }

  @ApiOperation({ summary: "List a user's active sessions" })
  @Get(':id/sessions')
  async listSessions(@Param('id') id: string) {
    const user = await this.ensureUserExists(id);
    const sessions = await this.sessionManager.getUserSessions(user.id);
    return {
      data: sessions
        .sort((a, b) => {
          const aTime = a.lastActive?.getTime() ?? a.updatedAt?.getTime() ?? 0;
          const bTime = b.lastActive?.getTime() ?? b.updatedAt?.getTime() ?? 0;
          return bTime - aTime;
        })
        .map((session) => this.toSessionResponse(session)),
    };
  }

  @ApiOperation({ summary: 'Revoke a single user session' })
  @Delete(':id/sessions/:sessionId')
  async revokeSession(@Param('id') id: string, @Param('sessionId') sessionId: string) {
    const user = await this.ensureUserExists(id);

    const sessions = await this.sessionManager.getUserSessions(user.id);
    try {
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) {
        throw new NotFoundException('Session not found for this user');
      }
      await this.sessionManager.revokeSession(session.id, 'admin');
      return { message: 'Session revoked successfully' };
    } catch (error) {
      throw new NotFoundException('Session not found for this user');
    }
  }
  
  @ApiOperation({ summary: "Revoke all of a user's sessions" })
  @Delete(':id/sessions')
  async revokeAllSessions(@Param('id') id: string) {
    const user = await this.ensureUserExists(id);
    await this.sessionManager.revokeAllUserSessions(user.id);
    return { message: 'All sessions revoked successfully' };
  }

  @ApiOperation({ summary: 'Delete a user' })
  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    await this.users.deleteUser(id);
    return { message: 'User removed' };
  }

  private async toSafeUser(user: NestAuthUser | null) {
    if (!user) {
      return null;
    }

    let userAccesses = user.userAccesses;
    if (!userAccesses?.length) {
      userAccesses = await this.userAccessRepository.find({
        where: { userId: user.id },
        relations: ['tenant', 'roles', 'roles.rolePermissions', 'roles.rolePermissions.permission'],
      });
    }

    const activeAccesses = (userAccesses?.filter((access) => access.status === NestAuthUserAccessStatusEnum.ACTIVE) ?? []).map((access) => ({
      id: access.id,
      userId: access.userId,
      tenantId: access.tenantId,
      tenant: access.tenant,
      roles: (access.roles ?? []).map((role) => mapRoleToResponse(role as any)),
      isDefault: access.isDefault,
      status: access.status,
      metadata: access.metadata ?? {},
      createdAt: access.createdAt,
      updatedAt: access.updatedAt,
    }));

    // PLATFORM scope — independent of the tenant memberships above. `null` when
    // the user holds no platform-access marker (i.e. is not a platform user).
    const platformAccess = user.platformAccess
      ? {
          id: user.platformAccess.id,
          userId: user.platformAccess.userId,
          roles: (user.platformAccess.roles ?? []).map((role) => mapRoleToResponse(role as any)),
          isActive: user.platformAccess.isActive,
          createdAt: user.platformAccess.createdAt,
          updatedAt: user.platformAccess.updatedAt,
        }
      : null;

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      userAccesses: activeAccesses,
      platformAccess,
      isPlatformUser: !!platformAccess,
      isActive: user.isActive,
      emailVerifiedAt: user.emailVerifiedAt,
      phoneVerifiedAt: user.phoneVerifiedAt,
      metadata: user.metadata ?? {},
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isMfaEnabled: user.isMfaEnabled,
    };
  }
}

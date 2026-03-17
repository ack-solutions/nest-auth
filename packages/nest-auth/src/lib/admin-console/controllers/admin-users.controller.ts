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
} from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminSessionGuard } from '../guards/admin-session.guard';
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
import { NestAuthUserAccess } from '../../tenant/entities/user-access.entity';
import { TenantModeEnum } from '@ackplus/nest-auth-contracts';

@Controller('auth/admin/api/users')
@UseGuards(AdminSessionGuard)
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
        return { isVerified: true };
      case 'unverified':
        return { isVerified: false };
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

  @Get()
  async listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('tenantId') tenantId?: string,
    @Query('roleName') roleName?: string,
  ) {
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
      baseFilter.roles = { name: roleName.trim() };
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

    // Get users and total count in a single query
    const [users, total] = await this.users.getUsersAndCount({
      where,
      relations: ['userAccesses', 'userAccesses.tenant', 'userAccesses.roles'],
      order: { createdAt: 'DESC' },
      skip,
      take: limitNum,
    });

    const safeUsers = await Promise.all(users.map((user) => this.toSafeUser(user)));

    return {
      data: safeUsers,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  @Post()
  async createUser(@Body() dto: AdminCreateUserDto) {
    const config = this.authConfigService.getConfig();
    const tenantEnabled = config.tenant?.enabled === true;
    const tenantMode = config.tenant?.mode ?? TenantModeEnum.ISOLATED;

    let tenantId: string | undefined;
    console.log(tenantEnabled , tenantMode)
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
        isVerified: dto.isVerified ?? false,
      },
      tenantId
    );

    const safeUser = await this.toSafeUser(user);
    return { user: safeUser };
  }

  @Get(':id')
  async getUser(@Param('id') id: string) {
    const user = await this.users.getUserById(id, {
      relations: ['mfaSecrets', 'identities', 'userAccesses', 'userAccesses.tenant', 'userAccesses.roles']
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const availableMethods = this.mfaService.getAvailableMethods();
    const [enabledMethods, sessions] = await Promise.all([
      this.mfaService.getEnabledMethods(user.id),
      this.sessionManager.getUserSessions(user.id),
    ]);

    const sortedSessions = sessions
      .sort((a, b) => {
        const aTime = a.lastActive?.getTime() ?? a.updatedAt?.getTime() ?? 0;
        const bTime = b.lastActive?.getTime() ?? b.updatedAt?.getTime() ?? 0;
        return bTime - aTime;
      })
      .map((session) => this.toSessionResponse(session));

    const safeUser = await this.toSafeUser(user);

    return {
      user: safeUser,
      loginMethods: {
        emailEnabled: !!user.email && !!user.emailVerifiedAt,
        phoneEnabled: !!user.phone && !!user.phoneVerifiedAt,
        hasPassword: !!user.passwordHash,
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

  @Patch(':id')
  async updateUser(@Param('id') id: string, @Body() dto: AdminUpdateUserDto) {
    let user = await this.users.getUserById(id, { relations: ['identities', 'userAccesses', 'userAccesses.tenant', 'userAccesses.roles'] });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const oldEmail = user.email;
    const oldPhone = user.phone;

    // Apply basic field updates if provided (including email and phone)
    if (dto.isActive !== undefined || dto.isVerified !== undefined || dto.metadata !== undefined ||
      dto.isMfaEnabled !== undefined || dto.email !== undefined || dto.phone !== undefined) {
      const updates: Partial<NestAuthUser> = {};
      if (dto.isActive !== undefined) updates.isActive = dto.isActive;
      if (dto.isVerified !== undefined) updates.isVerified = dto.isVerified;
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
    // Reload user with fresh memberships
    const reloadedUser = await this.users.getUserById(user.id, {
      relations: ['userAccesses', 'userAccesses.tenant', 'userAccesses.roles'],
    });
    const safeUser = await this.toSafeUser(reloadedUser);
    return { user: safeUser };
  }

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

  @Delete(':id/sessions/:sessionId')
  async revokeSession(@Param('id') id: string, @Param('sessionId') sessionId: string) {
    const user = await this.ensureUserExists(id);

    try {
      const session = await this.sessionManager.getSession(sessionId, false);
      if (session.userId !== user.id) {
        throw new NotFoundException('Session not found for this user');
      }
    } catch {
      throw new NotFoundException('Session not found for this user');
    }

    await this.sessionManager.revokeSession(sessionId);
    return { message: 'Session revoked successfully' };
  }

  @Delete(':id/sessions')
  async revokeAllSessions(@Param('id') id: string) {
    const user = await this.ensureUserExists(id);
    await this.sessionManager.revokeAllUserSessions(user.id);
    return { message: 'All sessions revoked successfully' };
  }

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
        relations: ['tenant', 'roles'],
      });
    }

    const activeAccesses = userAccesses?.filter((access) => access.isActive) ?? [];

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      userAccesses: activeAccesses,
      isActive: user.isActive,
      isVerified: user.isVerified,
      metadata: user.metadata ?? {},
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      emailVerifiedAt: user.emailVerifiedAt,
      phoneVerifiedAt: user.phoneVerifiedAt,
      isMfaEnabled: user.isMfaEnabled,
    };
  }
}

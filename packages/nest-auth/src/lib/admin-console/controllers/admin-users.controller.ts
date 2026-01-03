import {
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
import { TenantService } from '../../tenant/services/tenant.service';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthMFASecret } from '../../auth/entities/mfa-secret.entity';
import { EMAIL_AUTH_PROVIDER, PHONE_AUTH_PROVIDER } from '../../auth.constants';
import { FindOptionsWhere, Like } from 'typeorm';
import { MfaService } from '../../auth/services/mfa.service';
import { SessionManagerService } from '../../session/services/session-manager.service';
import { NestAuthSession } from '../../session/entities/session.entity';

@Controller('auth/admin/api/users')
@UseGuards(AdminSessionGuard)
export class AdminUsersController {
  constructor(
    private readonly users: UserService,
    private readonly tenantService: TenantService,
    private readonly mfaService: MfaService,
    private readonly sessionManager: SessionManagerService,
    @InjectRepository(NestAuthMFASecret)
    private readonly mfaSecretRepository: Repository<NestAuthMFASecret>,
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

  @Get()
  async listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
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

    // Build where clause with proper TypeORM typing
    let where: FindOptionsWhere<NestAuthUser>[] | FindOptionsWhere<NestAuthUser> = {};

    // Apply search filter with proper OR conditions using array syntax
    if (search && search.trim()) {
      const escapedSearch = this.escapeLikePattern(search.trim());
      const searchPattern = `%${escapedSearch}%`;

      // Base status filter if present
      const baseFilter: FindOptionsWhere<NestAuthUser> = {
        ...this.buildStatusFilter(status),
      };

      // Create OR conditions for search
      where = [
        { ...baseFilter, email: Like(searchPattern) },
        { ...baseFilter, phone: Like(searchPattern) },
        { ...baseFilter, tenantId: Like(searchPattern) },
      ];
    } else {
      // Apply status filter without search
      Object.assign(where as FindOptionsWhere<NestAuthUser>, this.buildStatusFilter(status));
    }

    // Get users and total count in a single query
    const [users, total] = await this.users.getUsersAndCount({
      where,
      relations: ['roles'],
      order: { createdAt: 'DESC' },
      skip,
      take: limitNum,
    });

    return {
      data: users.map((user) => this.toSafeUser(user)),
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
    const tenantId = await this.tenantService.resolveTenantId(dto.tenantId);
    const user = await this.users.createUser({
      email: dto.email,
      phone: dto.phone,
      tenantId,
      metadata: dto.metadata ?? {},
      isActive: dto.isActive ?? true,
      isVerified: dto.isVerified ?? false,
    });

    if (dto.password) {
      await user.setPassword(dto.password);
      await user.save();
    }

    if (dto.roles?.length) {
      await user.assignRoles(dto.roles);
      await user.save();
    }

    return { user: this.toSafeUser(user) };
  }

  @Get(':id')
  async getUser(@Param('id') id: string) {
    const user = await this.users.getUserById(id, {
      relations: ['roles', 'mfaSecrets', 'identities']
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

    return {
      user: this.toSafeUser(user),
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
    let user = await this.users.getUserById(id, { relations: ['roles', 'identities'] });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Apply basic field updates if provided
    if (dto.isActive !== undefined || dto.isVerified !== undefined || dto.metadata !== undefined ||
      dto.isMfaEnabled !== undefined) {
      const updates: Partial<NestAuthUser> = {};
      if (dto.isActive !== undefined) updates.isActive = dto.isActive;
      if (dto.isVerified !== undefined) updates.isVerified = dto.isVerified;
      if (dto.metadata !== undefined) updates.metadata = dto.metadata;
      if (dto.isMfaEnabled !== undefined) updates.isMfaEnabled = dto.isMfaEnabled;

      user = await this.users.updateUser(id, updates);
    }

    // Enable/disable email login
    if (dto.emailLoginEnabled !== undefined) {
      if (dto.emailLoginEnabled) {
        if (!user.email) {
          throw new NotFoundException('User has no email address');
        }
        user.emailVerifiedAt = user.emailVerifiedAt || new Date();
        // Ensure identity exists
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
        // Ensure identity exists
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

    // Apply role changes in-memory
    if (dto.roles) {
      await user.assignRoles(dto.roles);
    }

    // Save all changes
    await user.save();

    return { user: this.toSafeUser(user) };
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

  private toSafeUser(user: NestAuthUser | null) {
    if (!user) {
      return null;
    }
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      tenantId: user.tenantId,
      isActive: user.isActive,
      isVerified: user.isVerified,
      metadata: user.metadata ?? {},
      roles: user.roles?.map((role) => role.name) ?? [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      emailVerifiedAt: user.emailVerifiedAt,
      phoneVerifiedAt: user.phoneVerifiedAt,
      isMfaEnabled: user.isMfaEnabled,
    };
  }
}

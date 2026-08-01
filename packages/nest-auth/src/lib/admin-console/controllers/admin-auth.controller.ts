import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  UseFilters,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NestAuthEvents } from '../../auth.constants';
import { CsrfService } from '../../core/services/csrf.service';
import { AdminAuthService } from '../services/admin-auth.service';
import { AdminSessionService } from '../services/admin-session.service';
import { AdminConsoleConfigService } from '../services/admin-console-config.service';
import { AdminLoginDto } from '../dto/login.dto';
import { AdminResetPasswordDto } from '../dto/reset-password.dto';
import { AdminSignupDto } from '../dto/signup.dto';
import { AdminSessionGuard } from '../guards/admin-session.guard';
import { AuthExceptionFilter } from '../../auth/filters/auth-exception.filter';
import { ApiTags, ApiCookieAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ApiUnauthorized, ApiForbidden, ApiValidationError, Public } from '../../core';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { NestAuthAdminUser } from '../entities/admin-user.entity';
import { CreateDashboardAdminDto, UpdateDashboardAdminDto } from '../dto/create-dashboard-admin.dto';
import { AdminUserService } from '../services/admin-user.service';
import { compareKeys } from '../../utils/security.util';
import { UserService } from '../../user/services/user.service';
import { RoleService } from '../../role/services/role.service';
import { TenantService } from '../../tenant/services/tenant.service';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { NestAuthUser } from '../../user/entities/user.entity';
import { MoreThanOrEqual } from 'typeorm';

@Controller()
@UseFilters(AuthExceptionFilter)
@ApiTags('Admin · Console')
@ApiValidationError()
@ApiUnauthorized()
// Exempt the admin console from a consumer's app-wide global guard
// (APP_GUARD: NestAuthAuthGuard). The admin console authenticates with its own
// cookie-based AdminSessionGuard, not NestAuth JWTs, so a global NestAuth guard
// must not gate it. AdminSessionGuard remains the real guard on protected routes.
@Public()
export class AdminAuthController {
  constructor(
    private readonly adminAuth: AdminAuthService,
    private readonly sessions: AdminSessionService,
    private readonly config: AdminConsoleConfigService,
    private readonly adminUsers: AdminUserService,
    private readonly userService: UserService,
    private readonly roleService: RoleService,
    private readonly tenantService: TenantService,
    private readonly eventEmitter: EventEmitter2,
    private readonly csrf: CsrfService,
    @InjectRepository(NestAuthUser)
    private readonly userRepository: Repository<NestAuthUser>,
  ) { }

  /**
   * Best-effort out-of-band notification for a security-sensitive admin action
   * performed via the shared secret key. A listener can email the operator.
   * A listener failure must never break the admin operation.
   */
  private async emitAdminEvent(event: string, admin: NestAuthAdminUser, req: Request): Promise<void> {
    try {
      await this.eventEmitter.emitAsync(event, {
        adminId: admin.id,
        email: admin.email,
        ip: req?.ip,
        userAgent: req?.headers?.['user-agent'],
        at: new Date(),
      });
    } catch {
      // swallow — notifications are advisory
    }
  }

  private getCookieOptions() {
    const opts = this.config.getCookieOptions();
    const maxAge = this.sessions.getMaxAge();
    if (maxAge) {
      opts.maxAge = maxAge;
    }
    return opts;
  }

  @ApiOperation({ summary: 'Bootstrap the first admin (secret-key gated)' })
  @Post('signup')
  async signup(@Body() dto: AdminSignupDto, @Req() req: Request) {
    this.config.ensureEnabled();

    // Respect the same management switch as every other admin-mutation route.
    if (!this.config.allowAdminManagement()) {
      throw new ForbiddenException({
        message: 'Admin management is disabled',
        code: 'ADMIN_MANAGEMENT_DISABLED',
      });
    }

    // Validate secret key using constant-time comparison to prevent timing attacks
    const secretKey = this.config.getSecretKey();
    if (!secretKey) {
      throw new BadRequestException({
        message: 'Admin console secret key is not configured. Please configure adminConsole.secretKey in AuthModuleOptions.',
        code: 'ADMIN_CONSOLE_SECRET_NOT_CONFIGURED',
      });
    }

    if (!compareKeys(dto.secretKey, secretKey)) {
      throw new UnauthorizedException({
        message: 'Invalid secret key',
        code: 'INVALID_SECRET_KEY',
      });
    }

    // Bootstrap-only by default: once an admin exists, this public secret-key
    // endpoint is closed so a leaked secretKey can't mint unlimited super-admins.
    // Create further admins while signed in via POST <admin>/admins (session-
    // guarded). Opt out with adminConsole.allowPublicSignupAfterFirstAdmin.
    if (!this.config.allowPublicSignupAfterFirstAdmin()) {
      const existing = await this.adminUsers.listAdmins();
      if (existing.length > 0) {
        throw new ForbiddenException({
          message: 'An admin already exists. Sign in and create additional admins from the dashboard.',
          code: 'ADMIN_BOOTSTRAP_CLOSED',
        });
      }
    }

    const admin = await this.adminUsers.createAdmin({
      email: dto.email,
      password: dto.password,
      name: dto.name,
      metadata: dto.metadata || {},
    });

    await this.emitAdminEvent(NestAuthEvents.ADMIN_CREATED, admin, req);

    return {
      message: 'Admin user created successfully',
      admin: this.toSafeAdmin(admin),
    };
  }

  @ApiOperation({ summary: 'Admin login (sets the session cookie)' })
  @Post('login')
  async login(@Body() dto: AdminLoginDto, @Res({ passthrough: true }) res: Response) {
    this.config.ensureEnabled();
    const admin = await this.adminAuth.validateCredentials(dto.email, dto.password);
    const token = this.sessions.createSession(admin);
    const cookieOpts = this.getCookieOptions();
    res.cookie(this.sessions.getCookieName(), token, cookieOpts);

    // Issue the double-submit CSRF token so the dashboard can echo it on
    // state-changing requests (no-op unless security.csrf.enabled).
    if (this.csrf.isEnabled()) {
      const sameSite = typeof cookieOpts.sameSite === 'boolean'
        ? (cookieOpts.sameSite ? 'strict' : 'lax')
        : cookieOpts.sameSite;
      this.csrf.issue(res, {
        secure: cookieOpts.secure,
        sameSite,
        ...(cookieOpts.domain ? { domain: cookieOpts.domain } : {}),
        path: cookieOpts.path,
      });
    }

    return {
      message: 'Signed in successfully',
      admin: this.toSafeAdmin(admin),
    };
  }

  @ApiOperation({ summary: 'Current admin' })
  @Get('me')
  @UseGuards(AdminSessionGuard)
  async me(@CurrentAdmin() admin: NestAuthAdminUser) {
    return this.toSafeAdmin(admin);
  }

  @ApiOperation({ summary: 'Admin logout' })
  @Post('logout')
  @UseGuards(AdminSessionGuard)
  async logout(@CurrentAdmin() admin: NestAuthAdminUser, @Res({ passthrough: true }) res: Response) {
    // Invalidate server-side session if session ID is available
    try {
      await this.sessions.invalidateSessionForAdmin(admin.id);
    } catch (error) {
      // Log error but continue with logout to ensure client cookie is cleared
      console.error('Failed to invalidate admin session:', error);
    }

    res.cookie(this.sessions.getCookieName(), '', {
      ...this.getCookieOptions(),
      maxAge: 0,
    });
    return { message: 'Signed out' };
  }

  @ApiOperation({ summary: 'Public admin-console config' })
  @Get('config')
  async publicConfig() {
    // Only return properties that are actually used by the UI
    return {
      allowAdminManagement: this.config.allowAdminManagement(),
    };
  }

  @ApiOperation({ summary: 'Dashboard stats' })
  @Get('api/stats')
  @UseGuards(AdminSessionGuard)
  async getDashboardStats() {
    // Get total counts efficiently
    const [totalUsers, activeUsers, verifiedUsers] = await Promise.all([
      this.userService.countUsers(),
      this.userService.countUsers({ where: { isActive: true } }),
      this.userService.countUsers({ where: { emailVerifiedAt: Not(IsNull()) } }),
    ]);

    // Get roles and tenants counts
    const roles = await this.roleService.getRoles();
    const tenants = await this.tenantService.getTenants({ order: { createdAt: 'DESC' } });

    // Calculate recent signups (last 7 days) - server-side
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const recentSignups = await this.userService.countUsers({
      where: { createdAt: MoreThanOrEqual(sevenDaysAgo) },
    });

    // Calculate signups per day for the last 7 days using SQL aggregation
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const activityData: Array<{ name: string; users: number }> = [];

    // Initialize with 0 for each day
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dayName = dayNames[date.getDay()];
      activityData.push({ name: dayName, users: 0 });
    }

    // Query signups per day - fetch all signups from last 7 days and group in memory
    // This is more database-agnostic than using DATE() which varies by DB type
    const sevenDaysAgoStart = new Date();
    sevenDaysAgoStart.setDate(sevenDaysAgoStart.getDate() - 7);
    sevenDaysAgoStart.setHours(0, 0, 0, 0);

    const recentUsers = await this.userRepository.find({
      where: { createdAt: MoreThanOrEqual(sevenDaysAgoStart) },
      select: ['createdAt'],
    });

    // Group signups by day in memory
    recentUsers.forEach((user) => {
      const signupDate = new Date(user.createdAt);
      signupDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor((today.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff >= 0 && daysDiff <= 6) {
        const index = 6 - daysDiff;
        if (index >= 0 && index < activityData.length) {
          activityData[index].users += 1;
        }
      }
    });

    return {
      stats: {
        totalUsers,
        activeUsers,
        verifiedUsers,
        totalRoles: roles.length,
        totalTenants: tenants.length,
        recentSignups,
      },
      activityData,
    };
  }

  @ApiOperation({ summary: 'List admins' })
  @Get('admins')
  @UseGuards(AdminSessionGuard)
  async listAdmins() {
    if (!this.config.allowAdminManagement()) {
      throw new ForbiddenException('Admin management disabled');
    }
    const admins = await this.adminUsers.listAdmins();
    return {
      data: admins.map((admin) => this.toSafeAdmin(admin)),
    };
  }

  @ApiOperation({ summary: 'Create an admin' })
  @Post('admins')
  @UseGuards(AdminSessionGuard)
  async createAdmin(@Body() dto: CreateDashboardAdminDto) {
    if (!this.config.allowAdminManagement()) {
      throw new ForbiddenException('Admin management disabled');
    }
    const admin = await this.adminUsers.createAdmin(dto);
    return { admin: this.toSafeAdmin(admin) };
  }

  @ApiOperation({ summary: 'Update an admin' })
  @Patch('admins/:id')
  @UseGuards(AdminSessionGuard)
  async updateAdmin(@Param('id') id: string, @Body() dto: UpdateDashboardAdminDto) {
    if (!this.config.allowAdminManagement()) {
      throw new ForbiddenException('Admin management disabled');
    }
    const admin = await this.adminUsers.updateAdmin(id, dto);
    return { admin: this.toSafeAdmin(admin) };
  }

  @ApiOperation({ summary: 'Delete an admin' })
  @Delete('admins/:id')
  @UseGuards(AdminSessionGuard)
  async deleteAdmin(@Param('id') id: string) {
    if (!this.config.allowAdminManagement()) {
      throw new ForbiddenException('Admin management disabled');
    }
    await this.adminUsers.deleteAdmin(id);
    return { message: 'Admin deleted successfully' };
  }

  @ApiOperation({ summary: "Reset an admin's password (secret-key gated recovery)" })
  @Post('reset-password')
  async resetPassword(@Body() dto: AdminResetPasswordDto, @Req() req: Request) {
    this.config.ensureEnabled();

    // Respect the management switch (this is an admin mutation, like the others).
    if (!this.config.allowAdminManagement()) {
      throw new ForbiddenException({
        message: 'Admin management is disabled',
        code: 'ADMIN_MANAGEMENT_DISABLED',
      });
    }

    // Validate secret key using constant-time comparison to prevent timing attacks
    const secretKey = this.config.getSecretKey();
    if (!secretKey) {
      throw new UnauthorizedException({
        message: 'Admin console secret key not configured',
        code: 'SECRET_KEY_NOT_CONFIGURED',
      });
    }

    if (!compareKeys(dto.secretKey, secretKey)) {
      throw new UnauthorizedException({
        message: 'Invalid secret key',
        code: 'INVALID_SECRET_KEY',
      });
    }

    // Find the admin by email
    const admin = await this.adminUsers.findByEmail(dto.email);
    if (!admin) {
      // Return generic error to avoid revealing if email exists
      throw new UnauthorizedException({
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Update the password
    await this.adminUsers.updateAdmin(admin.id, { password: dto.newPassword });

    // OOB-notify: a secret-key password reset is security-sensitive.
    await this.emitAdminEvent(NestAuthEvents.ADMIN_PASSWORD_RESET, admin, req);

    return {
      message: 'Password reset successfully',
    };
  }

  private toSafeAdmin(admin: NestAuthAdminUser) {
    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      metadata: admin.metadata ?? {},
      lastLoginAt: admin.lastLoginAt,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };
  }
}

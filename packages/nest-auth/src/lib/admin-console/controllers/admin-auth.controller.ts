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
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AdminAuthService } from '../services/admin-auth.service';
import { AdminSessionService } from '../services/admin-session.service';
import { AdminConsoleConfigService } from '../services/admin-console-config.service';
import { AdminLoginDto } from '../dto/login.dto';
import { AdminResetPasswordDto } from '../dto/reset-password.dto';
import { AdminSignupDto } from '../dto/signup.dto';
import { AdminSessionGuard } from '../guards/admin-session.guard';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { AdminUser } from '../entities/admin-user.entity';
import { CreateDashboardAdminDto, UpdateDashboardAdminDto } from '../dto/create-dashboard-admin.dto';
import { AdminUserService } from '../services/admin-user.service';
import type { AdminConsoleOptions } from '../../core/interfaces/auth-module-options.interface';
import { compareKeys } from '../../utils/security.util';
import { UserService } from '../../user/services/user.service';
import { RoleService } from '../../role/services/role.service';
import { TenantService } from '../../tenant/services/tenant.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestAuthUser } from '../../user/entities/user.entity';
import { MoreThanOrEqual } from 'typeorm';

@Controller('auth/admin')
export class AdminAuthController {
  constructor(
    private readonly adminAuth: AdminAuthService,
    private readonly sessions: AdminSessionService,
    private readonly config: AdminConsoleConfigService,
    private readonly adminUsers: AdminUserService,
    private readonly userService: UserService,
    private readonly roleService: RoleService,
    private readonly tenantService: TenantService,
    @InjectRepository(NestAuthUser)
    private readonly userRepository: Repository<NestAuthUser>,
  ) { }

  private getCookieOptions() {
    const opts = this.config.getCookieOptions();
    const maxAge = this.sessions.getMaxAge();
    if (maxAge) {
      opts.maxAge = maxAge;
    }
    return opts;
  }

  @Post('signup')
  async signup(@Body() dto: AdminSignupDto) {
    this.config.ensureEnabled();

    // Validate secret key using constant-time comparison to prevent timing attacks
    const secretKey = this.config.getSecretKey();
    console.log('secretKey', secretKey);
    console.log('dto.secretKey', dto.secretKey);
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

    // Create admin user - allows multiple admins (no restriction like initialize)
    const admin = await this.adminUsers.createAdmin({
      email: dto.email,
      password: dto.password,
      name: dto.name,
      metadata: dto.metadata || {},
    });

    return {
      message: 'Admin user created successfully',
      admin: this.toSafeAdmin(admin),
    };
  }

  @Post('login')
  async login(@Body() dto: AdminLoginDto, @Res({ passthrough: true }) res: Response) {
    this.config.ensureEnabled();
    const admin = await this.adminAuth.validateCredentials(dto.email, dto.password);
    const token = this.sessions.createSession(admin);
    res.cookie(this.sessions.getCookieName(), token, this.getCookieOptions());
    return {
      message: 'Signed in successfully',
      admin: this.toSafeAdmin(admin),
    };
  }

  @Post('logout')
  @UseGuards(AdminSessionGuard)
  async logout(@CurrentAdmin() admin: AdminUser, @Res({ passthrough: true }) res: Response) {
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

  @Get('me')
  @UseGuards(AdminSessionGuard)
  async me(@CurrentAdmin() admin: AdminUser) {
    return this.toSafeAdmin(admin);
  }

  @Get('config')
  async publicConfig() {
    // Only return properties that are actually used by the UI
    return {
      allowAdminManagement: this.config.allowAdminManagement(),
    };
  }

  @Get('api/stats')
  @UseGuards(AdminSessionGuard)
  async getDashboardStats() {
    // Get total counts efficiently
    const [totalUsers, activeUsers, verifiedUsers] = await Promise.all([
      this.userService.countUsers(),
      this.userService.countUsers({ where: { isActive: true } }),
      this.userService.countUsers({ where: { isVerified: true } }),
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

  @Get('setup-status')
  async getSetupStatus() {
    this.config.ensureEnabled();

    // Check if nest-auth requires setup
    const userCount = await this.userService.countUsers();
    const rolesCount = await this.roleService.getRoles();

    const needsSetup = userCount === 0 || rolesCount.length === 0;

    return {
      needsSetup,
      stats: {
        usersCount: userCount,
        rolesCount: rolesCount.length,
      },
      setupSteps: [
        {
          id: 'roles',
          title: 'Create Roles',
          description: 'Set up roles and permissions for your users',
          completed: rolesCount.length > 0,
        },
        {
          id: 'users',
          title: 'Create Users',
          description: 'Add users to your system',
          completed: userCount > 0,
        },
      ],
    };
  }

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

  @Post('admins')
  @UseGuards(AdminSessionGuard)
  async createAdmin(@Body() dto: CreateDashboardAdminDto) {
    if (!this.config.allowAdminManagement()) {
      throw new ForbiddenException('Admin management disabled');
    }
    const admin = await this.adminUsers.createAdmin(dto);
    return { admin: this.toSafeAdmin(admin) };
  }

  @Patch('admins/:id')
  @UseGuards(AdminSessionGuard)
  async updateAdmin(@Param('id') id: string, @Body() dto: UpdateDashboardAdminDto) {
    if (!this.config.allowAdminManagement()) {
      throw new ForbiddenException('Admin management disabled');
    }
    const admin = await this.adminUsers.updateAdmin(id, dto);
    return { admin: this.toSafeAdmin(admin) };
  }

  @Delete('admins/:id')
  @UseGuards(AdminSessionGuard)
  async deleteAdmin(@Param('id') id: string) {
    if (!this.config.allowAdminManagement()) {
      throw new ForbiddenException('Admin management disabled');
    }
    await this.adminUsers.deleteAdmin(id);
    return { message: 'Admin deleted successfully' };
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: AdminResetPasswordDto) {
    this.config.ensureEnabled();

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

    return {
      message: 'Password reset successfully',
    };
  }

  private toSafeAdmin(admin: AdminUser) {
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

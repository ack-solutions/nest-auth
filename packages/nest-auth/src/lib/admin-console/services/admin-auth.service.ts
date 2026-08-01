import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { hash, verify, Algorithm } from '@node-rs/argon2';
import { AdminUserService } from './admin-user.service';
import { AdminSessionService } from './admin-session.service';
import { AdminConsoleConfigService } from './admin-console-config.service';
import { NestAuthAdminUser } from '../entities/admin-user.entity';
import { DebugLoggerService } from '../../core/services/debug-logger.service';
import { compareKeys } from '../../utils/security.util';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly adminUsers: AdminUserService,
    private readonly sessions: AdminSessionService,
    private readonly config: AdminConsoleConfigService,
    private readonly debugLogger: DebugLoggerService,
  ) { }

  async validateCredentials(email: string, password: string): Promise<NestAuthAdminUser> {
    const admin = await this.adminUsers.findByEmail(email);
    if (!admin) {
      // Equalize timing so a non-existent admin can't be distinguished from a
      // wrong password (argon2 verify runs on both paths) — closes admin-email
      // enumeration via a login timing side-channel.
      await verify(await this.dummyHash(), password).catch(() => false);
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await admin.validatePassword(password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    admin.lastLoginAt = new Date();
    await admin.save();
    return admin;
  }

  // Precomputed argon2id hash used ONLY to equalize verify timing on the
  // admin-not-found path (see validateCredentials). Same cost params as the
  // admin entity so the work is comparable. Computed once, then cached.
  private dummyHashPromise?: Promise<string>;
  private dummyHash(): Promise<string> {
    if (!this.dummyHashPromise) {
      this.dummyHashPromise = hash('nest-auth-admin-timing-equalizer', {
        algorithm: Algorithm.Argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });
    }
    return this.dummyHashPromise;
  }

  async createInitialAdmin(payload: {
    setupKey: string;
    email: string;
    password: string;
    name?: string;
    metadata?: Record<string, any>;
  }): Promise<NestAuthAdminUser> {
    this.config.ensureEnabled();
    const configuredKey = this.config.getSecretKey();

    if (!configuredKey) {
      throw new BadRequestException({
        message: 'Admin console setup key is not configured.',
        code: 'ADMIN_CONSOLE_SETUP_DISABLED',
      });
    }

    // Use constant-time comparison to prevent timing attacks
    if (!compareKeys(payload.setupKey, configuredKey)) {
      throw new UnauthorizedException({
        message: 'Invalid admin console setup key.',
        code: 'INVALID_ADMIN_CONSOLE_SETUP_KEY',
      });
    }

    const existingAdmins = await this.adminUsers.listAdmins();
    if (existingAdmins.length > 0) {
      throw new BadRequestException({
        message: 'Admin users already exist. Use the dashboard to manage administrators.',
        code: 'ADMIN_USERS_ALREADY_INITIALIZED',
      });
    }

    // Mask email to avoid logging PII
    const maskedEmail = payload.email.replace(/(.{2})(.*)(@.*)/, '$1****$3');
    this.debugLogger.info('Creating initial admin console user', 'AdminAuthService', {
      email: maskedEmail,
    });

    return this.adminUsers.createAdmin({
      email: payload.email,
      password: payload.password,
      name: payload.name,
      metadata: payload.metadata,
    });
  }

  createSession(admin: NestAuthAdminUser): string {
    return this.sessions.createSession(admin);
  }
}

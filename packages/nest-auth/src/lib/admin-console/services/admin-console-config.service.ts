import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { IAdminConsoleOptions } from '../../core/interfaces/auth-module-options.interface';
import { CookieOptions } from 'express';

@Injectable()
export class AdminConsoleConfigService {
  constructor(private readonly authConfigService: AuthConfigService) { }

  getConfig(): IAdminConsoleOptions {
    const authConfig = this.authConfigService.getConfig();
    return {
      enabled: true,
      basePath: '/auth/admin',
      sessionCookieName: 'nest_auth_admin',
      sessionDuration: '2h',
      ...authConfig.adminConsole
    };
  }

  ensureEnabled(): void {
    if (this.getConfig().enabled === false) {
      throw new NotFoundException('Admin console is disabled');
    }
  }

  getCookieName(): string {
    return this.getConfig().sessionCookieName ?? 'nest_auth_admin';
  }

  getBasePath(): string {
    return this.getConfig().basePath || '/auth/admin';
  }

  getSessionSecret(): string {
    // Use secretKey for session signing - unified key for all admin console security operations
    return this.authConfigService.getConfig().adminConsole?.secretKey ?? 'change-me-admin-secret';
  }

  getSessionDuration(): string | number {
    return this.getConfig().sessionDuration ?? '2h';
  }

  getCookieOptions(): CookieOptions {
    // Determine secure flag based on environment
    const secureDefault = process.env.NODE_ENV === 'production';
    const config = this.getConfig();

    const base: CookieOptions = {
      httpOnly: true,
      sameSite: 'lax',
      secure: secureDefault,
      path: this.getBasePath(),
    };

    return {
      ...base,
      ...(config.cookie ?? {}),
      path: config.cookie?.path ?? base.path,
    };
  }

  allowAdminManagement(): boolean {
    return this.getConfig().allowAdminManagement !== false;
  }

  getSecretKey(): string | undefined {
    return this.authConfigService.getConfig().adminConsole?.secretKey;
  }
}

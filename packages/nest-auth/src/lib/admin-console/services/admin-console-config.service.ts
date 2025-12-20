import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { AdminConsoleOptions } from '../../core/interfaces/auth-module-options.interface';
import { CookieOptions } from 'express';

@Injectable()
export class AdminConsoleConfigService {
  constructor(private readonly authConfig: AuthConfigService) { }

  get options(): AdminConsoleOptions {
    return this.authConfig.getConfig().adminConsole ?? ({} as AdminConsoleOptions);
  }

  ensureEnabled(): void {
    if (this.options?.enabled === false) {
      throw new NotFoundException('Admin console is disabled');
    }
  }

  getCookieName(): string {
    return this.options?.sessionCookieName ?? 'nest_auth_admin';
  }

  getBasePath(): string {
    return this.options?.basePath;
  }

  getSessionSecret(): string {
    // Use secretKey for session signing - unified key for all admin console security operations
    return this.options?.secretKey ?? 'change-me-admin-secret';
  }

  getSessionDuration(): string | number {
    return this.options?.sessionDuration ?? '2h';
  }

  getCookieOptions(): CookieOptions {
    // Determine secure flag based on environment
    const secureDefault = process.env.NODE_ENV === 'production';

    const base: CookieOptions = {
      httpOnly: true,
      sameSite: 'lax',
      secure: secureDefault,
      path: this.getBasePath(),
    };

    return {
      ...base,
      ...(this.options?.cookie ?? {}),
      path: this.options?.cookie?.path ?? base.path,
    };
  }

  allowAdminManagement(): boolean {
    return this.options?.allowAdminManagement !== false;
  }

  getSecretKey(): string | undefined {
    return this.options?.secretKey;
  }
}

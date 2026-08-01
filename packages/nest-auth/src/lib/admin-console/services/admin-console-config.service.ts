import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { IAdminConsoleOptions } from '../../core/interfaces/auth-module-options.interface';
import { CookieOptions } from 'express';
import { TenantModeEnum } from '@ackplus/nest-auth-contracts';

@Injectable()
export class AdminConsoleConfigService {
  constructor(private readonly authConfigService: AuthConfigService) { }

  getConfig(): IAdminConsoleOptions {
    const authConfig = this.authConfigService.getConfig();
    const routePrefix = authConfig.routePrefix || 'auth';
    const merged: IAdminConsoleOptions = {
      enabled: true,
      sessionCookieName: 'nest_auth_admin',
      sessionDuration: '2h',
      ...authConfig.adminConsole,
    };
    const adminPath = merged.path || 'admin';
    return {
      ...merged,
      path: adminPath,
      // SPA base / cookie path. Defaults to the served route (`/<prefix>/<path>`);
      // set explicitly to include a global prefix (e.g. `/api/auth/admin`).
      basePath: merged.basePath || `/${routePrefix}/${adminPath}`,
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
    return this.getConfig().basePath!;
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

    const merged: CookieOptions = {
      ...base,
      ...(config.cookie ?? {}),
      path: config.cookie?.path ?? base.path,
    };

    // A SameSite=None cookie is only sent cross-site over HTTPS and modern
    // browsers reject it without Secure — force it so the admin cookie can never
    // silently degrade to being sent in cleartext.
    if (merged.sameSite === 'none') {
      merged.secure = true;
    }

    return merged;
  }

  allowAdminManagement(): boolean {
    return this.getConfig().allowAdminManagement !== false;
  }

  getSecretKey(): string | undefined {
    return this.authConfigService.getConfig().adminConsole?.secretKey;
  }

  /** Tenant mode when tenant.enabled is true: 'isolated' | 'shared'. Null when tenant is disabled. */
  getTenantMode(): TenantModeEnum | null {
    const config = this.authConfigService.getConfig();
    if (!config.tenant?.enabled) return null;
    return config.tenant?.mode ?? TenantModeEnum.ISOLATED;
  }
}

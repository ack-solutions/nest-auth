/**
 * App Module
 * 
 * Main application module that integrates @ackplus/nest-auth for authentication.
 * This example demonstrates a production-grade setup with:
 * - Full NestAuthModule configuration with all features enabled
 * - Proper module separation (auth, users, sessions, profiles)
 * - Database configuration for session and user persistence
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NestAuthModule } from '@ackplus/nest-auth';
import { SessionStorageType } from '@ackplus/nest-auth';
import { NestAuthMFAMethodEnum, TenantModeEnum } from '@ackplus/nest-auth-contracts';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { buildDatabaseConfig } from './database.config';
import { DevCodeLogger } from './dev/dev-code-logger';
import { PlatformModule } from './platform/platform.module';
import { SessionsModule } from './sessions/sessions.module';
import { ProfileModule } from './profile/profile.module';
import { UserModule } from './user/user.module';

enum RoleGuardEnum {
  WEB = 'web',
  ADMIN = 'admin',
  PORTAL = 'portal',
  // Dedicated namespace for platform-level (super-admin) roles, isolated from
  // tenant-user roles. See src/platform/ for the platform-admin portal.
  PLATFORM = 'platform',
}

/**
 * Tenant config driven by the `TENANT_MODE` env var so the demo can be booted in
 * any of the three multi-tenancy modes without code changes:
 *   - `disabled` (default) — single-tenant; tenantId is rejected.
 *   - `shared`             — global users that can join multiple tenants (switchTenant).
 *   - `isolated`           — users scoped per tenant (same email allowed per tenant).
 */
function buildTenantConfig() {
  const mode = (process.env.TENANT_MODE || 'disabled').toLowerCase();
  if (mode === 'shared') {
    return { enabled: true, mode: TenantModeEnum.SHARED };
  }
  if (mode === 'isolated') {
    return { enabled: true, mode: TenantModeEnum.ISOLATED };
  }
  return { enabled: false };
}

@Module({
  imports: [
    /**
     * Event Emitter Module
     * Required for auth events (login, logout, password change, etc.)
     * Enables event-driven architecture for audit logging, notifications, etc.
     */
    EventEmitterModule.forRoot(),

    /**
     * TypeORM Database Module
     * Configures the database connection for auth + app entities.
     * Defaults to Postgres; uses portable in-memory SQLite when
     * `DB_DRIVER=sqlite` or `NODE_ENV=test` (see `database.config.ts`).
     */
    TypeOrmModule.forRoot(buildDatabaseConfig()),


    NestAuthModule.forRoot({
      /**
       * Make auth services globally available
       * This allows injecting auth services anywhere without importing the module
       */
      isGlobal: true,

      /**
       * Application name - used in MFA setup (Google Authenticator display)
       */
      appName: 'NestAuth Example',

      // JWT Configuration now lives under `session`

      emailAuth: {
        enabled: true,
      },
      phoneAuth: {
        enabled: true,
      },
      passwordless: {
        enabled: true,
        allowSignUp: true,
      },

      otp: {
        codeExpiresIn: '15m',
        length: 6,
        format: 'numeric',
      },

      /**
       * Session configuration
       * Controls session behavior
       */
      session: {
        // Storage type for sessions
        storageType: SessionStorageType.DATABASE,
        // Access token delivery method
        // - 'header': Return tokens in response body, client sends in Authorization header
        // - 'cookie': Set tokens in httpOnly cookies (more secure for web)
        accessTokenType: null,
        jwt: {
          secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
        },
        // Access token TTL (drives JWT `exp` for access tokens)
        accessTokenValidity: '1m',
        // Refresh token TTL (drives JWT `exp` for refresh tokens)
        refreshTokenValidity: '7d',
        // Maximum concurrent sessions per user (0 = unlimited)
        maxSessionsPerUser: 5,
        // Extend session on activity
        slidingExpiration: false,
        cookieOptions: {
          // Use secure cookies in production (requires HTTPS)
          secure: process.env.NODE_ENV === 'production',
          // Same-site policy for CSRF protection
          sameSite: 'lax',
          // HTTP-only prevents JavaScript access to cookies
          httpOnly: true,
        },
      },

      tenant: buildTenantConfig(),

      // Only these guards can be used for roles/permissions. Admin UI shows them in a dropdown; to add more, extend RoleGuardEnum and list here.
      roleGuards: Object.values(RoleGuardEnum),

      /**
       * Platform access — the first-class, cross-tenant super-admin mechanism
       * (a `NestAuthPlatformAccess` row per user; see src/platform/).
       *
       * `validate(request)` is the origin-lock: a user's platform roles are only
       * resolved into their session when this returns true. We gate on a header
       * the platform-admin portal sends, so a leaked token from a normal tenant
       * origin can NOT be used as a platform-god token. Returns false for normal
       * tenant logins, so tenant RBAC is unaffected.
       */
      platformAccess: {
        enabled: true,
        validate: (request: any) => request?.headers?.['x-platform-portal'] === 'true',
      },

      /**
       * Multi-Factor Authentication (MFA) configuration
       * Supports TOTP (Google Authenticator), Email, and SMS
       */
      mfa: {
        enabled: true,
        // Allow users to toggle MFA on/off
        allowUserToggle: true,
        // Allow users to choose their preferred MFA method
        allowMethodSelection: true,
        // Available MFA methods (use enum values)
        methods: [NestAuthMFAMethodEnum.TOTP, NestAuthMFAMethodEnum.EMAIL, NestAuthMFAMethodEnum.SMS],
        // TOTP-specific settings
        trustedDeviceSecret: process.env.TRUSTED_DEVICE_SECRET || 'your-super-secret-trusted-device-secret-change-in-production',
        totp: {
          // Issuer name shown in authenticator app
          issuer: 'NestAuth Example',
          // Period in seconds (standard is 30)
          period: 30,
        },
      },

      /**
       * User registration settings
       */
      registration: {
        // Allow new users to register
        enabled: true,
        // Auto login after signup
        autoLoginAfterSignup: true,
      },

      /**
       * Debug logging (disable in production; also kept quiet under tests)
       */
      debug: {
        enabled: process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test',
      },

      adminConsole: {
        enabled: true,
        secretKey: process.env.ADMIN_CONSOLE_SECRET_KEY || 'cArX1qCWcih8JVk8P19HT0vTrXnR8HcFPMpzminV/XE=',
      },
    }),

    /**
     * Feature Modules
     * Separated by domain for clean architecture
     */
    SessionsModule,
    ProfileModule,
    UserModule,
    PlatformModule.register(),
  ],
  controllers: [AppController],
  providers: [AppService, DevCodeLogger],
})
export class AppModule { }

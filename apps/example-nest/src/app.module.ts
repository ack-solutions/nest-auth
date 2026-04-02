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
import { NestAuthModule, NestAuthEntities } from '@ackplus/nest-auth';
import { SessionStorageType } from '@ackplus/nest-auth';
import { NestAuthMFAMethodEnum, TenantModeEnum } from '@ackplus/nest-auth-contracts';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SessionsModule } from './sessions/sessions.module';
import { ProfileModule } from './profile/profile.module';
import { AppUser } from './user/user.entity';
import { UserModule } from './user/user.module';

enum RoleGuardEnum {
  WEB = 'web',
  ADMIN = 'admin',
  PORTAL = 'portal',
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
     * Configures database connection for auth entities
     */
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'ajaykhandla',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'nest-auth-example',
      // Include nest-auth entities for user, session, and MFA storage
      entities: [...NestAuthEntities, AppUser],
      synchronize: true, // Auto-sync schema - disable in production
      logging: false,
    }),


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

      tenant: {
        enabled: false,
      },

      // Only these guards can be used for roles/permissions. Admin UI shows them in a dropdown; to add more, extend RoleGuardEnum and list here.
      roleGuards: Object.values(RoleGuardEnum),

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
       * Debug logging (disable in production)
       */
      debug: {
        enabled: process.env.NODE_ENV !== 'production',
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

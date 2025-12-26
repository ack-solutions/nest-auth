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
import { NestAuthMFAMethodEnum } from '@ackplus/nest-auth-contracts';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SessionsModule } from './sessions/sessions.module';
import { ProfileModule } from './profile/profile.module';

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
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'nest-auth-example',
      // Include nest-auth entities for user, session, and MFA storage
      entities: [...NestAuthEntities],
      synchronize: true, // Auto-sync schema - disable in production
      logging: false,
    }),

    /**
     * NestAuth Module
     * Core authentication module providing:
     * - User registration and login
     * - Session management with JWT
     * - Multi-factor authentication
     * - Password management
     * - Email verification
     */
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

      /**
       * Access token delivery method
       * - 'header': Return tokens in response body, client sends in Authorization header
       * - 'cookie': Set tokens in httpOnly cookies (more secure for web)
       */
      accessTokenType: 'header',

      /**
       * JWT Configuration (REQUIRED)
       * Configures token signing and expiration
       */
      jwt: {
        /**
         * JWT Secret - In production, use environment variable
         * IMPORTANT: Never hardcode secrets in production!
         */
        secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
        /**
         * Access token expiration
         * Short for security - client must refresh frequently
         */
        accessTokenExpiresIn: '15m',
        /**
         * Refresh token expiration
         * Longer for user convenience
         */
        refreshTokenExpiresIn: '7d',
      },

      /**
       * Session configuration
       * Controls session behavior
       */
      session: {
        // Storage type for sessions
        storageType: SessionStorageType.DATABASE,
        // Maximum concurrent sessions per user (0 = unlimited)
        maxSessionsPerUser: 5,
        // Extend session on activity
        slidingExpiration: true,
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
        methods: [NestAuthMFAMethodEnum.TOTP, NestAuthMFAMethodEnum.EMAIL],
        // TOTP-specific settings
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
       * Cookie configuration for session handling
       * Used when accessTokenType is 'cookie'
       */
      cookieOptions: {
        // Use secure cookies in production (requires HTTPS)
        secure: process.env.NODE_ENV === 'production',
        // Same-site policy for CSRF protection
        sameSite: 'lax',
        // HTTP-only prevents JavaScript access to cookies
        httpOnly: true,
      },

      /**
       * Default tenant for single-tenant applications
       */
      defaultTenant: {
        name: 'Default',
        slug: 'default',
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

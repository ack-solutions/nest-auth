/**
 * Main Application Entry Point
 * 
 * Bootstraps the NestJS application with:
 * - CORS configuration for frontend communication
 * - Cookie parsing for session management
 * - Swagger documentation for API exploration
 * - Global validation pipes for DTO validation
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { default as cookieParser } from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  /**
   * Cookie Parser Middleware
   * Required for cookie-based session management
   * NestAuth can use either cookies or Authorization headers for tokens
   */
  app.use(cookieParser());

  /**
   * CORS Configuration
   * Essential for frontend-backend communication
   *
   * SECURITY NOTES:
   * - In production, replace 'origin' with specific frontend URLs
   * - 'credentials: true' is required for cookie-based auth
   */
  app.enableCors({
    // Frontend URLs - add your frontend origins here
    origin: [
      'http://localhost:4200', // Vite default
      'http://localhost:3333', // Same as backend (for some setups)
      'http://localhost:3001', // Next.js example
      'http://localhost:5173', // Next.js example
    ],
    // Required for cookies to be sent cross-origin
    credentials: true,
    // Allowed HTTP methods
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // Headers the client is allowed to use
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'X-Tenant-Id', // For multi-tenant applications
    ],
    // Headers exposed to the client
    exposedHeaders: ['Set-Cookie'],
  });

  /**
   * Global Validation Pipe
   * Automatically validates incoming DTOs using class-validator
   * 
   * Options explained:
   * - whitelist: Strip properties not in the DTO
   * - forbidNonWhitelisted: Throw error if extra properties sent
   * - transform: Auto-transform payloads to DTO instances
   * - transformOptions.enableImplicitConversion: Convert types automatically
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  
  app.setGlobalPrefix('api');

  /**
   * Swagger Documentation
   * Provides interactive API documentation at /api
   * Essential for frontend developers and API testing
   */
  const config = new DocumentBuilder()
    .setTitle('NestAuth Example API')
    .setDescription(
      `
      ## Complete Authentication API Reference

      This API demonstrates all authentication features of @ackplus/nest-auth:

      ### Authentication
      - User registration and login
      - JWT-based session management
      - Password reset flow

      ### Multi-Factor Authentication
      - TOTP setup (Google Authenticator)
      - MFA verification during login
      - Recovery code generation

      ### Session Management
      - List active sessions
      - Revoke individual sessions
      - Logout from all devices

      ### User Profile
      - View and update profile
      - Change password
      `
    )
    .setVersion('1.0')
    .addTag('auth', 'Authentication endpoints (login, signup, password reset)')
    .addTag('mfa', 'Multi-factor authentication endpoints')
    .addTag('sessions', 'Session management endpoints')
    .addTag('profile', 'User profile endpoints')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT token',
        in: 'header',
      },
      'access-token', // Security scheme name
    )
    .addCookieAuth('access_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'access_token',
      description: 'Cookie-based authentication',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'NestAuth Example API',
  });

  /**
   * Start Server
   * Default port 3000, can be overridden via PORT environment variable
   */
  const port = process.env.PORT ?? 3333;
  await app.listen(port);

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                  NestAuth Example API                      ║
╠═══════════════════════════════════════════════════════════╣
║  🚀 Server running on: http://localhost:${port}              ║
║  📚 Swagger docs:      http://localhost:${port}/api          ║
║                                                            ║
║  Auth Endpoints:                                           ║
║  • POST /auth/signup     - Register new user               ║
║  • POST /auth/login      - Login with credentials          ║
║  • POST /auth/logout     - Logout current session          ║
║  • POST /auth/refresh    - Refresh access token            ║
║  • GET  /auth/me         - Get current user                ║
║                                                            ║
║  MFA Endpoints:                                            ║
║  • GET  /auth/mfa/status - Get MFA status                  ║
║  • POST /auth/mfa/setup-totp     - Setup authenticator     ║
║  • POST /auth/mfa/verify-totp-setup - Verify setup         ║
║                                                            ║
║  Session Endpoints:                                        ║
║  • GET    /sessions      - List active sessions            ║
║  • DELETE /sessions/:id  - Revoke specific session         ║
║  • DELETE /sessions      - Revoke all sessions             ║
╚═══════════════════════════════════════════════════════════╝
  `);
}

bootstrap();

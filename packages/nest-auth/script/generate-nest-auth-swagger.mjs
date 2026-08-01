import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const nestAuthPackage = require('../../nest-auth/package.json');
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, '..');
const repoRoot = resolve(packageRoot, '..', '..');
const distEntryCandidates = [
  join(packageRoot, 'dist', 'index.js'),
  join(repoRoot, 'dist', 'packages', 'nest-auth', 'src', 'index.js'),
];
const distEntry = distEntryCandidates.find((candidate) => existsSync(candidate));

if (!distEntry) {
  throw new Error(
    'Missing dist build for @ackplus/nest-auth. Run "pnpm -C packages/nest-auth build" before generating the Swagger spec.'
  );
}

const distRoot = dirname(distEntry);
const { NestAuthModule } = require(distEntry);
const { AuthModule } = require(join(distRoot, 'lib', 'auth', 'auth.module.js'));
const { AdminConsoleModule } = require(join(distRoot, 'lib', 'admin-console', 'admin-console.module.js'));

class NestAuthSwaggerModule { }
Module({
  imports: [
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'sqljs',
      autoSave: false,
      location: ':memory:',
      dropSchema: true,
      synchronize: true,
      logging: false,
      autoLoadEntities: true,
    }),
    NestAuthModule.forRoot({
      session: {
        jwt: {
          secret: 'swagger-doc-signing-secret-not-for-production-use',
        },
      },
      adminConsole: {
        enabled: true, // Enable so the admin controllers are documented
        // 32+ chars — the admin console fails closed on a short/weak secret.
        secretKey: 'swagger-doc-admin-secret-not-for-production-use',
      },
    }),
  ],
})(NestAuthSwaggerModule);

async function generateSwaggerSpec() {
  const app = await NestFactory.create(NestAuthSwaggerModule, {
    logger: ['error'],
  });

  await app.init();

  const documentConfig = new DocumentBuilder()
    .setTitle('@ackplus/nest-auth API')
    .setDescription(
      [
        'Authentication & authorization API for **@ackplus/nest-auth**.',
        '',
        '### Conventions',
        '- **Base URL** — routes are shown relative to your app’s global prefix. The reference example app uses `/api`, so a route like `POST /auth/login` is called at `POST /api/auth/login`.',
        '- **Auth** — most endpoints require a Bearer access token: `Authorization: Bearer <accessToken>`. The **Admin** endpoints use an httpOnly session cookie set by `POST /auth/admin/login`.',
        '- **Token modes** — in *header* mode (default) tokens are returned in the response body; in *cookie* mode they are set as httpOnly cookies. Controlled by `accessTokenType`.',
        '- **Errors** — failures return `{ statusCode, error, message, code }`; the machine-readable `code` is the value to branch on.',
        '',
        'Browse by section in the sidebar: **Authentication**, **Password**, **Verification**, **Passwordless**, **MFA**, and the **Admin** groups.',
      ].join('\n'),
    )
    .setVersion(nestAuthPackage.version ?? '0.0.0')
    .addServer('/api', 'Default — your app’s global prefix (the example app uses `api`)')
    .addServer('/', 'No global prefix')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Paste an access token from /auth/login' },
      'access-token',
    )
    .addCookieAuth('nest_auth_admin', { type: 'apiKey', in: 'cookie', name: 'nest_auth_admin' }, 'admin-session')
    .addTag('Authentication', 'Sign up, log in/out, refresh, sessions, password, verification, passwordless, account introspection, tenant switching.')
    .addTag('MFA', 'Multi-factor: TOTP, email/SMS OTP, recovery codes, trusted devices.')
    .addTag('Admin · Console', 'Admin sign-in (cookie session), profile, dashboard stats, and managing admins.')
    .addTag('Admin · Users', 'Cross-tenant user management: list, create, update, delete, sessions, MFA reset.')
    .addTag('Admin · Roles', 'Create and manage roles + their permissions.')
    .addTag('Admin · Permissions', 'Create and manage permissions.')
    .addTag('Admin · Tenants', 'Create and manage tenants.')
    .build();

  const document = SwaggerModule.createDocument(app, documentConfig, {
    include: [AuthModule, AdminConsoleModule],
  });

  const destinations = [
    join(repoRoot, 'apps/docs/public/api'),
    join(repoRoot, 'apps/docs/src/data/openapi'),
    join(repoRoot, 'packages/nest-auth-admin/src/data'), // For admin UI build-time consumption (was ui/src/data before T-002)
    join(packageRoot, 'dist/lib/admin-console/static'), // For runtime consumption
  ];

  console.log('Generating Swagger spec for @ackplus/nest-auth');
  console.log('Destinations:', destinations);

  destinations.forEach((folder) => {
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, 'nest-auth.json'), JSON.stringify(document, null, 2), 'utf8');
  });

  await app.close();
}

generateSwaggerSpec()
  .then(() => {
    console.log('Generated Swagger spec for @ackplus/nest-auth');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to generate Swagger spec for @ackplus/nest-auth');
    console.error(error?.message ?? error);
    process.exit(1);
  });

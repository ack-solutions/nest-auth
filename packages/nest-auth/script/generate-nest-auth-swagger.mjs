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
      jwt: {
        secret: 'swagger-secret',
      },
      adminConsole: {
        enabled: false, // Disable admin console for doc generation
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
    .setDescription('OpenAPI specification generated from the Nest Auth module')
    .setVersion(nestAuthPackage.version ?? '0.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, documentConfig, {
    include: [AuthModule],
  });

  const destinations = [
    join(repoRoot, 'apps/docs/public/api'),
    join(repoRoot, 'apps/docs/src/data/openapi'),
    join(packageRoot, 'ui/src/data'),
  ];

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

/**
 * Boots the REAL example `AppModule` for end-to-end API tests — NO MOCKS.
 *
 * Everything a request hits in production is wired the same way here:
 *   - the real `NestAuthModule` config from `app.module.ts`
 *   - the real consumer modules (profile / sessions / user-sync)
 *   - real TypeORM (portable in-memory SQLite — see `setup-env.ts` + `database.config.ts`)
 *   - the same global prefix (`/api`), `ValidationPipe`, and cookie-parser as `main.ts`
 *
 * The only thing we don't do is `app.listen()` — supertest talks to the in-memory
 * HTTP server directly via `app.getHttpServer()`.
 */

import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { default as cookieParser } from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { attachEventCapture, type EventCapture } from './event-capture';

export interface E2EApp {
    app: INestApplication;
    /** Underlying HTTP server — pass to supertest's `request(api.http)`. */
    http: any;
    /** Captured auth events (read OTP / reset / verification codes off here). */
    events: EventCapture;
    /** Resolve a provider/service by token or class (e.g. a repository). */
    get<T = any>(token: any): T;
    /** Tear down. Call in `afterAll`. */
    close(): Promise<void>;
}

export async function createTestApp(): Promise<E2EApp> {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();

    const app = moduleRef.createNestApplication();

    // Mirror src/main.ts exactly so routes + validation behave identically.
    app.use(cookieParser());
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: false,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: { enableImplicitConversion: true },
        }),
    );
    app.setGlobalPrefix('api');

    await app.init();

    const bus = moduleRef.get(EventEmitter2, { strict: false });
    const events = attachEventCapture(bus);

    return {
        app,
        http: app.getHttpServer(),
        events,
        get: <T = any>(token: any): T => moduleRef.get<T>(token, { strict: false }),
        close: async () => {
            await app.close();
        },
    };
}

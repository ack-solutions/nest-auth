/**
 * Regression: provider registration under `forRootAsync`.
 *
 * `AuthProviderRegistryService` captured `AuthConfigService.getOptions()` in its
 * CONSTRUCTOR and registered the default providers there. It does not depend on
 * NEST_AUTH_ASYNC_OPTIONS_PROVIDER, and it lives in `CoreModule` — an IMPORT of
 * `NestAuthModule` — so Nest constructs it before the host module's async
 * options factory runs. It therefore read the package DEFAULTS
 * (`emailAuth.enabled: true`, `phoneAuth.enabled: false`) and never registered
 * the phone provider: `POST /auth/login` with `providerName: 'phone'` came back
 * INVALID_PROVIDER for every app configured via forRootAsync.
 *
 * Each provider had the same capture (`this.enabled = this.options.x?.enabled`
 * in the constructor), so even a late registration carried a stale `enabled`.
 *
 * Same class of bug as the 2.8.0 JwtService "captured options at construction".
 *
 * NO MOCKS — real Nest app, real forRootAsync, real DB, real HTTP.
 */
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Test, type TestingModule } from '@nestjs/testing';
import { Injectable, Module, ValidationPipe, type INestApplication } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NestAuthModule, type IAuthModuleOptions } from '../../src';
import { AuthProviderRegistryService } from '../../src/lib/core/services/auth-provider-registry.service';

const PHONE = '+15551230001';
const PASSWORD = 'AsyncPhone!1';

/** Supplies options asynchronously, exactly like an app's NestAuthConfigService. */
@Injectable()
class NestAuthConfigService {
    async createAuthModuleOptions(): Promise<IAuthModuleOptions> {
        // a real async hop, so the factory cannot resolve synchronously
        await new Promise((r) => setTimeout(r, 5));
        return {
            appName: 'Async Test',
            session: { jwt: { secret: 'test-secret-do-not-use-in-prod' } } as any,
            emailAuth: { enabled: true } as any,
            phoneAuth: { enabled: true } as any,   // <-- the whole point
            adminConsole: { enabled: false } as any,
        };
    }
}

@Module({
    imports: [
        EventEmitterModule.forRoot(),
        TypeOrmModule.forRoot({
            type: 'sqljs',
            autoSave: false,
            location: ':memory:',
            autoLoadEntities: true,
            synchronize: true,
            dropSchema: true,
        } as any),
        NestAuthModule.forRootAsync({ useClass: NestAuthConfigService }),
    ],
})
class AsyncRootModule {}

describe('forRootAsync — providers register from the ASYNC options, not the defaults', () => {
    let app: INestApplication;
    let moduleRef: TestingModule;

    beforeAll(async () => {
        moduleRef = await Test.createTestingModule({ imports: [AsyncRootModule] }).compile();
        app = moduleRef.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
        await app.init();
    }, 60_000);

    afterAll(async () => {
        await app?.close();
    });

    it('registers the phone provider (was: never registered → INVALID_PROVIDER)', () => {
        const registry = moduleRef.get(AuthProviderRegistryService, { strict: false });
        expect(registry.hasProvider('phone')).toBe(true);
        expect(registry.hasProvider('email')).toBe(true);
    });

    it('reports the phone provider as ENABLED (was: stale `enabled` captured at construction)', () => {
        const registry = moduleRef.get(AuthProviderRegistryService, { strict: false });
        const names = registry.getEnabledProviders().map((p: any) => p.providerName);
        expect(names).toContain('phone');
    });

    it('phone signup + login work end to end over HTTP', async () => {
        const signup = await request(app.getHttpServer())
            .post('/auth/signup')
            .send({ phone: PHONE, password: PASSWORD });
        expect(signup.status, JSON.stringify(signup.body)).toBeLessThan(300);

        const login = await request(app.getHttpServer())
            .post('/auth/login')
            .send({ providerName: 'phone', credentials: { phone: PHONE, password: PASSWORD } });

        // was: 400/401 INVALID_PROVIDER
        expect(login.status, JSON.stringify(login.body)).toBeLessThan(300);
        expect(login.body.accessToken).toBeTruthy();
    });

    it('email login still works (no regression to the provider that DID register)', async () => {
        const email = 'async-email@test.local';
        const s = await request(app.getHttpServer()).post('/auth/signup').send({ email, password: PASSWORD });
        expect(s.status, JSON.stringify(s.body)).toBeLessThan(300);

        const login = await request(app.getHttpServer())
            .post('/auth/login')
            .send({ providerName: 'email', credentials: { email, password: PASSWORD } });
        expect(login.status, JSON.stringify(login.body)).toBeLessThan(300);
    });
});

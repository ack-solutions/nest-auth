import { Module, DynamicModule, MiddlewareConsumer, Provider } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { IAuthModuleAsyncOptions, IAuthModuleOptions, IAuthModuleOptionsFactory } from './core/interfaces/auth-module-options.interface';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RequestContextMiddleware } from './request-context/request-context.middleware';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { RoleModule } from './role/role.module';
import { SessionModule } from './session/session.module';
import { TenantModule } from './tenant/tenant.module';
import { CoreModule } from './core/core.module';
import { AuthConfigService } from './core/services/auth-config.service';
import { RefreshTokenInterceptor } from './auth/interceptors/refresh-token.interceptor';
import { NEST_AUTH_ASYNC_OPTIONS_PROVIDER } from './auth.constants';
import { AdminConsoleModule } from './admin-console/admin-console.module';
import { AuditService } from './audit/services/audit.service';


@Module({})
export class NestAuthModule {
  static forRoot(options: IAuthModuleOptions): DynamicModule {
    const mergedOptions = this.getOptions(options);

    // Set options in static service
    AuthConfigService.setOptions(mergedOptions);

    // Conditionally add refresh token interceptor (enabled by default)
    const providers: Provider[] = [AuditService];
    if (mergedOptions.enableAutoRefresh !== false) {
      providers.push({
        provide: APP_INTERCEPTOR,
        useClass: RefreshTokenInterceptor,
      });
    }

    return {
      module: NestAuthModule,
      global: mergedOptions.isGlobal,
      imports: [
        EventEmitterModule,
        CoreModule,
        AuthModule,
        TenantModule,
        UserModule,
        RoleModule,
        SessionModule,
        AdminConsoleModule,
      ],
      providers,
      exports: [
        CoreModule,
        AuthModule,
        TenantModule,
        UserModule,
        RoleModule,
        SessionModule,
        AdminConsoleModule,
        AuditService,
      ],
    };
  }

  static forRootAsync(options: IAuthModuleAsyncOptions): DynamicModule {
    const asyncProviders = this.createAsyncProviders(options);

    // Add refresh token interceptor provider (enabled by default)
    const providers: Provider[] = [...asyncProviders, AuditService];
    if (options.enableAutoRefresh !== false) {
      providers.push({
        provide: APP_INTERCEPTOR,
        useClass: RefreshTokenInterceptor,
      });
    }

    return {
      module: NestAuthModule,
      global: options.isGlobal,
      imports: [
        EventEmitterModule,
        CoreModule,
        AuthModule,
        TenantModule,
        UserModule,
        RoleModule,
        SessionModule,
        AdminConsoleModule,
        ...(options.imports || []),
      ],
      providers,
      exports: [
        CoreModule,
        AuthModule,
        TenantModule,
        UserModule,
        RoleModule,
        SessionModule,
        AdminConsoleModule,
        AuditService,
      ],
    };
  }

  private static createAsyncProviders(options: IAuthModuleAsyncOptions): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createAsyncOptionsProvider(options)];
    }

    if (options.useClass) {
      return [
        this.createAsyncOptionsProvider(options),
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
      ];
    }

    return [];
  }

  private static createAsyncOptionsProvider(options: IAuthModuleAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide: NEST_AUTH_ASYNC_OPTIONS_PROVIDER,
        useFactory: async (...args: any[]) => {
          const userOptions = await options.useFactory(...args);
          const mergedOptions = this.getOptions(userOptions);
          AuthConfigService.setOptions(mergedOptions);
          return mergedOptions;
        },
        inject: options.inject || [],
      };
    }

    return {
      provide: NEST_AUTH_ASYNC_OPTIONS_PROVIDER,
      useFactory: async (optionsFactory: IAuthModuleOptionsFactory) => {
        const userOptions = await optionsFactory.createAuthModuleOptions();
        const mergedOptions = this.getOptions(userOptions);
        AuthConfigService.setOptions(mergedOptions);
        return mergedOptions;
      },
      inject: [options.useExisting || options.useClass!],
    };
  }

  private static getOptions(options: IAuthModuleOptions): IAuthModuleOptions {
    const deepmerge = require('deepmerge');
    // Use default options from AuthConfigService - single source of truth
    const defaultOptions = AuthConfigService.getDefaultOptions();
    return deepmerge(defaultOptions, options);
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('auth/*');
  }
}

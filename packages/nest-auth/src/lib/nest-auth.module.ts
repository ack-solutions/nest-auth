import { Module, DynamicModule, MiddlewareConsumer, Provider } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
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

import { NEST_AUTH_ASYNC_OPTIONS_PROVIDER } from './auth.constants';
import { AdminConsoleModule } from './admin-console/admin-console.module';
import { AuditService } from './audit/services/audit.service';
import deepmerge from 'deepmerge';
import { PermissionModule } from './permission';

@Module({})
export class NestAuthModule {
  static forRoot(options: IAuthModuleOptions): DynamicModule {
    const mergedOptions = this.getOptions(options);

    // Set options in static service
    AuthConfigService.setOptions(mergedOptions);

    // Conditionally add refresh token interceptor (enabled by default)
    const providers: Provider[] = [AuditService];

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
        PermissionModule,
        SessionModule,
        AdminConsoleModule,
        // Mount the HTTP controllers under the configurable prefix (default
        // 'auth') and admin sub-path (default 'admin'). Controllers use paths
        // relative to these.
        RouterModule.register([
          { path: mergedOptions.routePrefix || 'auth', module: AuthModule },
          {
            path: `${mergedOptions.routePrefix || 'auth'}/${mergedOptions.adminConsole?.path || 'admin'}`,
            module: AdminConsoleModule,
          },
        ]),
      ],
      providers,
      exports: [
        CoreModule,
        AuthModule,
        TenantModule,
        UserModule,
        RoleModule,
        PermissionModule,
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
        PermissionModule,
        SessionModule,
        AdminConsoleModule,
        // Async options resolve after routing is set up, so the prefix uses the
        // defaults here. To customise routePrefix / adminConsole.path, use the
        // synchronous forRoot().
        RouterModule.register([
          { path: 'auth', module: AuthModule },
          { path: 'auth/admin', module: AdminConsoleModule },
        ]),
        ...(options.imports || []),
      ],
      providers,
      exports: [
        CoreModule,
        AuthModule,
        TenantModule,
        UserModule,
        RoleModule,
        PermissionModule,
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
    // Use default options from AuthConfigService - single source of truth
    const defaultOptions = AuthConfigService.getDefaultOptions();
    const merged = deepmerge(defaultOptions, options) as IAuthModuleOptions;

    // deepmerge deep-clones plain objects, which would strip the methods off a
    // custom session-store instance. Restore it by reference so the methods work.
    if (options.session?.store && merged.session) {
      merged.session.store = options.session.store;
    }

    // Same reasoning: `customAuthProviders` are BaseAuthProvider class instances.
    // The deep-merge would clone them into plain objects and strip their methods
    // (validate / attachRepositories / …). Preserve the caller's instances by
    // reference so the provider registry gets working providers.
    if (options.customAuthProviders) {
      merged.customAuthProviders = options.customAuthProviders;
    }

    // A caller-provided `mfa.methods` list must REPLACE the default, not be
    // concatenated with it. deepmerge concatenates arrays, silently merging the
    // default [EMAIL, TOTP] back in — so an app that set `methods: ['totp']` still
    // got email. Honour the explicit list so a subset (e.g. TOTP-only) is possible.
    if (options.mfa?.methods?.length && merged.mfa) {
      merged.mfa.methods = [...new Set(options.mfa.methods)];
    }

    return merged;
  }

  configure(consumer: MiddlewareConsumer) {
    // Apply to ALL routes — not just `auth/*` — so consumer controllers can use
    // `RequestContext.currentUser()/currentSession()/currentTenantId()` too.
    // Previously scoped to `auth/*`, which made RequestContext silently return
    // null inside any consumer-owned route (e.g. a /profile or /sessions controller).
    consumer.apply(RequestContextMiddleware).forRoutes(allRoutesWildcard());
  }
}

/**
 * Wildcard path matching every route, in a form the installed router accepts.
 * Express 5 (path-to-regexp v8) rejects a bare `*` and logs
 * `LegacyRouteConverter: Unsupported route path` — it needs a NAMED wildcard.
 * Express 4 only understands `*`. Detect by the installed Express major so we
 * silence the warning on Express 5 without breaking Express 4.
 */
function allRoutesWildcard(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const expressVersion: string = require('express/package.json').version;
    if (parseInt(String(expressVersion).split('.')[0], 10) >= 5) {
      return '{*splat}';
    }
  } catch {
    /* fall through to the legacy wildcard */
  }
  return '*';
}

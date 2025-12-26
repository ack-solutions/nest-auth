export * from './lib/nest-auth.module';

export * from './lib/auth.constants';

// Modules
export * from './lib/auth';
export * from './lib/session';
export * from './lib/user';
export * from './lib/role';
export * from './lib/tenant';
export * from './lib/core';
export * from './lib/request-context';

// Types and interfaces for configuration
export type {
  IAuthModuleOptions,
  IAuthModuleAsyncOptions,
  IAuthModuleOptionsFactory,
  IDefaultTenantOptions,
  IAdminConsoleOptions,
} from './lib/core/interfaces/auth-module-options.interface';

// Static configuration service
export { AuthConfigService } from './lib/core/services/auth-config.service';

// Debug logging
export { DebugLoggerService, DebugLogLevel } from './lib/core/services/debug-logger.service';
export type { DebugLogOptions } from './lib/core/services/debug-logger.service';

// Admin console exports
export { NestAuthAdminUser } from './lib/admin-console/entities/admin-user.entity';

export * from './lib/nest-auth.module';

export * from './lib/auth.constants';

// Modules
export * from './lib/auth';
export * from './lib/session';
export * from './lib/user';
export * from './lib/role';
export * from './lib/permission';
export * from './lib/tenant';
export * from './lib/core';

// Request context
export * from './lib/request-context';

// Types and interfaces for configuration
export type {
  IAuthModuleOptions,
  IAuthModuleAsyncOptions,
  IAuthModuleOptionsFactory,
  IDefaultTenantOptions,
  IAdminConsoleOptions,
  IPasswordlessOptions,
} from './lib/core/interfaces/auth-module-options.interface';

// Static configuration service
export { AuthConfigService } from './lib/core/services/auth-config.service';

// Debug logging
export { DebugLoggerService, DebugLogLevel } from './lib/core/services/debug-logger.service';

// Auth-state cache — lets the guard skip its per-request user read.
// `invalidateUser()` is the escape hatch for writes TypeORM cannot see
// (raw SQL, QueryBuilder bulk updates, migrations, another app on the same DB).
export { NestAuthCacheService, AUTH_STATE_CACHE } from './lib/core/services/nest-auth-cache.service';
export type { CachedUserState } from './lib/core/services/nest-auth-cache.service';
export {
    DEFAULT_DISTRIBUTED_USER_STATE_TTL_SECONDS,
    DEFAULT_IN_PROCESS_USER_STATE_TTL_SECONDS,
} from './lib/core/services/nest-auth-cache.service';
export { RedisAuthStateCache, InProcessAuthStateCache } from './lib/core/services/auth-state-cache';
export type { AuthStateCache } from './lib/core/services/auth-state-cache';
export { NestAuthUserCacheSubscriber } from './lib/user/subscribers/user-cache.subscriber';
export type { DebugLogOptions } from './lib/core/services/debug-logger.service';

// Admin console exports
export { NestAuthAdminUser } from './lib/admin-console/entities/admin-user.entity';
export { CurrentAdmin } from './lib/admin-console/decorators/current-admin.decorator';

// Utils (for consistent email/phone normalization when integrating)
export { normalizedEmail, normalizedPhone } from './lib/utils';

// Re-export all shared types and enums from contracts for consumers
export * from '@ackplus/nest-auth-contracts';

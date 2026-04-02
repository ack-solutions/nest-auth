export * from './tenant.module';
export * from './services/tenant.service';
export * from './events/tenant-created.event';
export * from './events/tenant-deleted.event';
export * from './events/tenant-updated.event';
export * from './entities/tenant.entity';
export * from '../user/entities/user-access.entity';

export { ITenantContextService } from './tenant-context/tenant-context.interface';
export { CurrentTenantId, CurrentTenant } from './decorators/current-tenant.decorator';
export { CurrentUserAccess, CurrentMembership } from './decorators/current-user-access.decorator';

// Re-export slug utilities for convenience
export { isValidSlug, toSlug } from '../utils/slug.util';

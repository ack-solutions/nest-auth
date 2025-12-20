export * from './tenant.module';
export * from './services/tenant.service';
export * from './events/tenant-created.event';
export * from './events/tenant-deleted.event';
export * from './events/tenant-updated.event';
export * from './entities/tenant.entity';

// Re-export slug utilities for convenience
export { isValidSlug, toSlug } from '../utils/slug.util';

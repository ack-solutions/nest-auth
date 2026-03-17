import { Injectable } from '@nestjs/common';
import { TenantService } from '../../services/tenant.service';
import { BaseTenantContextService } from './base-tenant-context.service';

/**
 * Tenant context when tenant.enabled is true and mode is SHARED.
 * User can belong to multiple tenants; active tenant from session, JWT, or resolver.
 */
@Injectable()
export class SharedTenantContextService extends BaseTenantContextService {
    constructor(tenantService: TenantService) {
        super(tenantService);
    }
}

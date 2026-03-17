import { Injectable } from '@nestjs/common';
import { TenantService } from '../../services/tenant.service';
import { BaseTenantContextService } from './base-tenant-context.service';

/**
 * Tenant context when tenant.enabled is true and mode is ISOLATED.
 * One tenant per user; current tenant is default tenant or from session.
 */
@Injectable()
export class IsolatedTenantContextService extends BaseTenantContextService {
    constructor(tenantService: TenantService) {
        super(tenantService);
    }
}

import { Injectable } from '@nestjs/common';
import { ITenantContextService } from '../tenant-context.interface';
import { NestAuthTenant } from '../../entities/tenant.entity';
import { NestAuthUserAccess } from '../../entities/user-access.entity';
import { TenantService } from '../../services/tenant.service';
import { RequestContext } from '../../../request-context/request-context';

/**
 * Tenant context when tenant.enabled is true and mode is ISOLATED.
 * One tenant per user; current tenant is default tenant or from session.
 */
@Injectable()
export class IsolatedTenantContextService implements ITenantContextService {
    constructor(private readonly tenantService: TenantService) {}

    isEnabled(): boolean {
        return true;
    }

    async getCurrentTenantId(): Promise<string | null> {
        const tenantId = RequestContext.currentTenantId();
        return tenantId ?? null;
    }

    async getCurrentTenant(): Promise<NestAuthTenant | null> {
        const id = await this.getCurrentTenantId();
        return id ? this.tenantService.getTenantById(id) : null;
    }

    async getCurrentAccess(): Promise<NestAuthUserAccess | null> {
        return RequestContext.currentUserAccess();
    }

}

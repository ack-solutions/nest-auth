import { Injectable } from '@nestjs/common';
import { ITenantContextService } from '../tenant-context.interface';
import { NestAuthUserAccess } from '../../entities/user-access.entity';
import { TenantService } from '../../services/tenant.service';
import { RequestContext } from '../../../request-context/request-context';
/**
 * Tenant context when tenant.enabled is true and mode is SHARED.
 * User can belong to multiple tenants; active tenant from session, JWT, or resolver.
 */
@Injectable()
export class SharedTenantContextService implements ITenantContextService {
    constructor(
        private readonly tenantService: TenantService,
    ) {}

    isEnabled(): boolean {
        return true;
    }

    async getCurrentTenantId(): Promise<string | null> {
        const tenantId = RequestContext.currentTenantId();
        return tenantId ?? null;
    }

    async getCurrentTenant(){
        const id = await this.getCurrentTenantId();
        return id ? this.tenantService.getTenantById(id) : null;
    }

    async getCurrentAccess(): Promise<NestAuthUserAccess | null> {
        return RequestContext.currentUserAccess();
    }

}

import { ITenantContextService } from '../tenant-context.interface';
import { NestAuthTenant } from '../../entities/tenant.entity';
import { NestAuthUserAccess } from '../../entities/user-access.entity';
import { TenantService } from '../../services/tenant.service';
import { RequestContext } from '../../../request-context/request-context';

/**
 * Base tenant context when tenant.enabled is true.
 * Shared implementation for getCurrentTenantId, getCurrentTenant, and getCurrentAccess
 * using RequestContext and TenantService. Isolated and Shared modes differ only in
 * semantics (one tenant per user vs multiple); resolution is the same.
 */
export abstract class BaseTenantContextService implements ITenantContextService {
    constructor(protected readonly tenantService: TenantService) {}

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

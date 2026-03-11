import { Injectable, Optional, Inject } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { ITenantContextService } from '../tenant-context.interface';
import { NestAuthUserAccess } from '../../entities/user-access.entity';
import { TenantService } from '../../services/tenant.service';
import { RequestContext } from '../../../request-context/request-context';
import { AuthConfigService } from '../../../core/services/auth-config.service';
import { ERROR_CODES } from '../../../auth.constants';

/**
 * Tenant context when tenant.enabled is true and mode is SHARED.
 * User can belong to multiple tenants; active tenant from session, JWT, or resolver.
 */
@Injectable()
export class SharedTenantContextService implements ITenantContextService {
    constructor(
        private readonly tenantService: TenantService,

        private readonly authConfig: AuthConfigService,
    ) {}

    isEnabled(): boolean {
        return true;
    }

    async getCurrentTenantId(): Promise<string | null> {
        const session = RequestContext.currentSession();
        const fromSession = session?.data?.tenantId;
        if (fromSession) {
            return fromSession;
        }
        return null;
    }

    async getCurrentTenant(){
        const id = await this.getCurrentTenantId();
        return id ? this.tenantService.getTenantById(id) : null;
    }

    async getCurrentAccess(): Promise<NestAuthUserAccess | null> {
        return RequestContext.currentUserAccess();
    }

}

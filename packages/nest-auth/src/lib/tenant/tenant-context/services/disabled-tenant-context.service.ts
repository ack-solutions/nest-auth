import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { ITenantContextService } from '../tenant-context.interface';
import { NestAuthTenant } from '../../entities/tenant.entity';
import { NestAuthUserAccess } from '../../entities/user-access.entity';

/**
 * No-op tenant context when tenant support is disabled.
 * Auth works without tenant checks; no tenant resolution or validation.
 */
@Injectable()
export class DisabledTenantContextService implements ITenantContextService {
    isEnabled(): boolean {
        return false;
    }

    async getCurrentTenantId(): Promise<string | null> {
        return null;
    }

    async getCurrentTenant(): Promise<NestAuthTenant | null> {
        return null;
    }

    async getCurrentAccess(): Promise<NestAuthUserAccess | null> {
        return null;
    }

}

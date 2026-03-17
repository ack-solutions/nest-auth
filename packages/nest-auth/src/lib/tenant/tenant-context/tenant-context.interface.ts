import { Request } from 'express';
import { NestAuthTenant } from '../entities/tenant.entity';
import { NestAuthUserAccess } from '../entities/user-access.entity';

export interface ITenantContextService {
    isEnabled(): boolean;
    getCurrentTenantId(): Promise<string | null>;
    getCurrentTenant(): Promise<NestAuthTenant | null>;
    /** Current user's access for the active tenant (includes roles). */
    getCurrentAccess(): Promise<NestAuthUserAccess | null>;
}

import { NestAuthTenant } from "../entities/tenant.entity";

export interface TenantDeletedEventPayload {
    tenant: NestAuthTenant;
}

export class TenantDeletedEvent {
    constructor(
        public readonly payload: TenantDeletedEventPayload,
    ) { }
}

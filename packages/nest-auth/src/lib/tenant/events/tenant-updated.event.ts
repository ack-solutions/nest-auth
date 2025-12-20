import { NestAuthTenant } from "../entities/tenant.entity";

export interface TenantUpdatedEventPayload {
    tenant: NestAuthTenant;
    updatedFields: string[];
}

export class TenantUpdatedEvent {
    constructor(
        public readonly payload: TenantUpdatedEventPayload,
    ) { }
}

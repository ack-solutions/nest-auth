import { NestAuthTenant } from "../entities/tenant.entity";

export interface TenantCreatedEventPayload {
    tenant: NestAuthTenant;
}

export class TenantCreatedEvent {
    constructor(public readonly payload: TenantCreatedEventPayload) { }
}

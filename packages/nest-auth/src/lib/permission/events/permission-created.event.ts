import { NestAuthPermission } from "../entities/permission.entity";

export interface PermissionCreatedEventPayload {
    permission: NestAuthPermission;
}

export class PermissionCreatedEvent {
    constructor(public readonly payload: PermissionCreatedEventPayload) { }
}

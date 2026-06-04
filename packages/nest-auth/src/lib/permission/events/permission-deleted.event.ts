import { NestAuthPermission } from "../entities/permission.entity";

export interface PermissionDeletedEventPayload {
    permission: NestAuthPermission;
}

export class PermissionDeletedEvent {
    constructor(public readonly payload: PermissionDeletedEventPayload) { }
}

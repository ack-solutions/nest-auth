import { NestAuthPermission } from "../entities/permission.entity";

export interface PermissionUpdatedEventPayload {
    permission: NestAuthPermission;
    updatedFields: string[];
}

export class PermissionUpdatedEvent {
    constructor(public readonly payload: PermissionUpdatedEventPayload) { }
}

import { NestAuthRole } from "../entities/role.entity";

export interface RoleUpdatedEventPayload {
    role: NestAuthRole;
    updatedFields: string[];
}

export class RoleUpdatedEvent {
    constructor(public readonly payload: RoleUpdatedEventPayload) { }
}

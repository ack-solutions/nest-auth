import { NestAuthRole } from "../entities/role.entity";

export interface RoleCreatedEventPayload {
    role: NestAuthRole;
}

export class RoleCreatedEvent {
    constructor(public readonly payload: RoleCreatedEventPayload) { }
}

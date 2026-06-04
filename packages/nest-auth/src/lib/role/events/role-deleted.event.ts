import { NestAuthRole } from "../entities/role.entity";

export interface RoleDeletedEventPayload {
    role: NestAuthRole;
}

export class RoleDeletedEvent {
    constructor(public readonly payload: RoleDeletedEventPayload) { }
}

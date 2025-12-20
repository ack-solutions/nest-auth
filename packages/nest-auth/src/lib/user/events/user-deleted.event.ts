import { NestAuthUser } from "../entities/user.entity";

export interface UserDeletedEventPayload {
    user: NestAuthUser;
    tenantId?: string;
}

export class UserDeletedEvent {
    constructor(
        public readonly payload: UserDeletedEventPayload,
    ) { }
}

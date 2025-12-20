import { NestAuthUser } from "../entities/user.entity";

export interface UserUpdatedEventPayload {
    user: NestAuthUser;
    tenantId?: string;
    updatedFields: string[];
}

export class UserUpdatedEvent {
    constructor(
        public readonly payload: UserUpdatedEventPayload,
    ) { }
}

import { NestAuthUser } from "../entities/user.entity";

export interface UserDeletedEventPayload {
    user: NestAuthUser;
}

export class UserDeletedEvent {
    constructor(
        public readonly payload: UserDeletedEventPayload,
    ) { }
}

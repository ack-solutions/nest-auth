import { NestAuthUser } from "../../user/entities/user.entity";

export interface User2faDisabledEventPayload {
    user: NestAuthUser;
}

export class User2faDisabledEvent {
    constructor(
        public readonly payload: User2faDisabledEventPayload,
    ) { }

    get user(): NestAuthUser {
        return this.payload.user;
    }
}

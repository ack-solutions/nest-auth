import { NestAuthUser } from "../../user/entities/user.entity";

export interface UserPasswordChangedEventPayload {
    user: NestAuthUser;
    initiatedBy: 'user' | 'admin';
}

export class UserPasswordChangedEvent {
    constructor(
        public readonly payload: UserPasswordChangedEventPayload,
    ) { }

    get user(): NestAuthUser {
        return this.payload.user;
    }

    get initiatedBy(): 'user' | 'admin' {
        return this.payload.initiatedBy;
    }
}

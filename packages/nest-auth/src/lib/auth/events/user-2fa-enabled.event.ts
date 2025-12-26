import { NestAuthUser } from "../../user/entities/user.entity";
import { NestAuthMFAMethodEnum } from "@ackplus/nest-auth-contracts";

export interface User2faEnabledEventPayload {
    user: NestAuthUser;
    method?: NestAuthMFAMethodEnum;
}

export class User2faEnabledEvent {
    constructor(
        public readonly payload: User2faEnabledEventPayload,
    ) { }

    get user(): NestAuthUser {
        return this.payload.user;
    }

    get method(): NestAuthMFAMethodEnum | undefined {
        return this.payload.method;
    }
}

import { NestAuthUser } from "../../user/entities/user.entity";
import { MFAMethodEnum } from "../../core/interfaces/mfa-options.interface";

export interface User2faEnabledEventPayload {
    user: NestAuthUser;
    method?: MFAMethodEnum;
}

export class User2faEnabledEvent {
    constructor(
        public readonly payload: User2faEnabledEventPayload,
    ) { }

    get user(): NestAuthUser {
        return this.payload.user;
    }

    get method(): MFAMethodEnum | undefined {
        return this.payload.method;
    }
}

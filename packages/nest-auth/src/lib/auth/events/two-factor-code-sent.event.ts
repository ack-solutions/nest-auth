import { NestAuthUser } from "../../user/entities/user.entity";
import { NestAuthMFAMethodEnum } from "@ackplus/nest-auth-contracts";

export interface TwoFactorCodeSentEventPayload {
    user: NestAuthUser;
    tenantId?: string;
    method: NestAuthMFAMethodEnum;
    code: string;
}

export class TwoFactorCodeSentEvent {
    constructor(
        public readonly payload: TwoFactorCodeSentEventPayload,
    ) { }
}

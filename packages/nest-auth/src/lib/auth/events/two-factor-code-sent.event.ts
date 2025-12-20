import { NestAuthUser } from "../../user/entities/user.entity";
import { MFAMethodEnum } from "../../core/interfaces/mfa-options.interface";

export interface TwoFactorCodeSentEventPayload {
    user: NestAuthUser;
    tenantId?: string;
    method: MFAMethodEnum;
    code: string;
}

export class TwoFactorCodeSentEvent {
    constructor(
        public readonly payload: TwoFactorCodeSentEventPayload,
    ) { }
}

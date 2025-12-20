import { NestAuthUser } from "../../user/entities/user.entity";
import { SessionPayload } from "../../core";
export interface LoggedOutEventPayload {
    user: NestAuthUser;
    tenantId?: string;
    session: SessionPayload;
    logoutType: 'user' | 'admin' | 'system';
    reason?: string;
}

export class LoggedOutEvent {
    constructor(
        public readonly payload: LoggedOutEventPayload,
    ) { }
}

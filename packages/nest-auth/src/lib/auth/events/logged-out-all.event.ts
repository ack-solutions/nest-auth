import { SessionPayload } from "../../core";
import { NestAuthUser } from "../../user/entities/user.entity";

export interface LoggedOutAllEventPayload {
    user: NestAuthUser;
    tenantId?: string;
    metadata?: Record<string, any>;
    sessions: SessionPayload[];
    logoutType: 'user' | 'admin' | 'system';
    reason?: string;
    currentSessionId?: string;
}

export class LoggedOutAllEvent {
    constructor(
        public readonly payload: LoggedOutAllEventPayload,
    ) { }
}

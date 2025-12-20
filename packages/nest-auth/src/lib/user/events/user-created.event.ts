import { NestAuthUser } from '../entities/user.entity';

export interface UserCreatedEventPayload {
    user: NestAuthUser;
    input?: any;
    tenantId?: string;
}

export class UserCreatedEvent {
    constructor(public readonly payload: UserCreatedEventPayload) { }
}

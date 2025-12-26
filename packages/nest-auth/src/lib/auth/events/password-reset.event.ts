
import { NestAuthUser } from "../../user/entities/user.entity";
import { NestAuthResetPasswordRequestDto } from '../dto/requests/reset-password.request.dto';

export interface PasswordResetEventPayload {
    user: NestAuthUser;
    tenantId?: string;
    input: NestAuthResetPasswordRequestDto;
}

export class PasswordResetEvent {
    constructor(
        public readonly payload: PasswordResetEventPayload,
    ) { }
}

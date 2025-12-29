
import { NestAuthUser } from "../../user/entities/user.entity";
import { NestAuthResetPasswordWithTokenRequestDto } from '../dto/requests/reset-password-with-token.request.dto';

export interface PasswordResetEventPayload {
    user: NestAuthUser;
    tenantId?: string;
    input: NestAuthResetPasswordWithTokenRequestDto;
}

export class PasswordResetEvent {
    constructor(
        public readonly payload: PasswordResetEventPayload,
    ) { }
}

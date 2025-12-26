import { NestAuthUser } from "../../user/entities/user.entity";
import { NestAuthForgotPasswordRequestDto } from '../dto/requests/forgot-password.request.dto';
import { BaseAuthProvider } from "../../core/providers/base-auth.provider";
import { NestAuthOTP } from "../entities/otp.entity";

export interface PasswordResetRequestedEventPayload {
    user: NestAuthUser;
    tenantId?: string;
    input: NestAuthForgotPasswordRequestDto;
    otp: NestAuthOTP;
    provider: BaseAuthProvider;
}

export class PasswordResetRequestedEvent {
    constructor(
        public readonly payload: PasswordResetRequestedEventPayload,
    ) { }
}

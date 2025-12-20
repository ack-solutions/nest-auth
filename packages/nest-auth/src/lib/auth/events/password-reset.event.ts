import { NestAuthUser } from "../../user/entities/user.entity";
import { ResetPasswordRequestDto } from "../dto/requests/reset-password.request.dto";

export interface PasswordResetEventPayload {
    user: NestAuthUser;
    tenantId?: string;
    input: ResetPasswordRequestDto;
}

export class PasswordResetEvent {
    constructor(
        public readonly payload: PasswordResetEventPayload,
    ) { }
}

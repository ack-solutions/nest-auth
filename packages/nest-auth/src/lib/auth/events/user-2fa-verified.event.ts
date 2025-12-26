import { NestAuthUser } from "../../user/entities/user.entity";
import { NestAuthVerify2faRequestDto } from '../dto/requests/verify-2fa.request.dto';
import { SessionPayload } from "../../core";
import { AuthTokensResponseDto } from "../dto/responses/auth.response.dto";

export interface User2faVerifiedEventPayload {
    user: NestAuthUser;
    tenantId?: string;
    input: NestAuthVerify2faRequestDto;
    session: SessionPayload;
    tokens: AuthTokensResponseDto;
}

export class User2faVerifiedEvent {
    constructor(
        public readonly payload: User2faVerifiedEventPayload,
    ) { }
}

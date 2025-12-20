import { NestAuthUser } from "../../user/entities/user.entity";
import { AuthTokensResponseDto } from "../dto/responses/auth.response.dto";
import { LoginRequestDto } from "../dto/requests/login.request.dto";
import { SessionPayload } from "../../core";
import { BaseAuthProvider } from "../../core/providers/base-auth.provider";

export interface UserLoggedInEventPayload {
    user: NestAuthUser;
    tenantId?: string;
    input: LoginRequestDto;
    provider: BaseAuthProvider;
    session: SessionPayload;
    tokens: AuthTokensResponseDto;
    isRequiresMfa: boolean;
}

// User Management Events
export class UserLoggedInEvent {
    constructor(
        public readonly payload: UserLoggedInEventPayload,
    ) { }
}

import { NestAuthUser } from "../../user/entities/user.entity";
import { AuthTokensResponseDto } from "../dto/responses/auth.response.dto";
import { SignupRequestDto } from "../dto/requests/signup.request.dto";
import { SessionPayload } from "../../core";
import { BaseAuthProvider } from "../../core/providers/base-auth.provider";

export interface UserRegisteredEventPayload {
    user: NestAuthUser;
    tenantId?: string;
    input: SignupRequestDto;
    provider: BaseAuthProvider;
    session: SessionPayload;
    tokens: AuthTokensResponseDto;
    isRequiresMfa: boolean;
}

// User Management Events
export class UserRegisteredEvent {
    constructor(
        public readonly payload: UserRegisteredEventPayload,
    ) { }
}

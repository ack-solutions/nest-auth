import { SessionPayload } from "../../core";
import { AuthTokensResponseDto } from "../dto/responses/auth.response.dto";

export interface UserRefreshTokenEventPayload {
    session: SessionPayload;
    tokens: AuthTokensResponseDto;
    oldRefreshToken: string;
}

export class UserRefreshTokenEvent {
    constructor(
        public readonly payload: UserRefreshTokenEventPayload,
    ) { }
}

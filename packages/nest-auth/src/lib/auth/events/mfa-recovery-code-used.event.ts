import { NestAuthUser } from "../../user/entities/user.entity";
import { SessionPayload } from "../../core";
import { AuthTokensResponseDto } from "../dto/responses/auth.response.dto";

export interface MfaRecoveryCodeUsedEventPayload {
    user: NestAuthUser;
    tenantId?: string | null;
    session: SessionPayload;
    tokens: AuthTokensResponseDto;
}

/**
 * Emitted when a user completes a sign-in by redeeming an MFA recovery (backup)
 * code via `POST /auth/mfa/verify-recovery-code`. Security-relevant — apps often
 * alert the account owner ("a backup code was used to sign in").
 */
export class MfaRecoveryCodeUsedEvent {
    constructor(
        public readonly payload: MfaRecoveryCodeUsedEventPayload,
    ) { }
}

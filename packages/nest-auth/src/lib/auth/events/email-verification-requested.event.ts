import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthOTP } from '../entities/otp.entity';

export interface EmailVerificationRequestedEventPayload {
    user: NestAuthUser;
    tenantId?: string;
    otp: NestAuthOTP;
    /** Plaintext verification code for email templates (entity stores hash). */
    code: string;
}

export class EmailVerificationRequestedEvent {
    constructor(public readonly payload: EmailVerificationRequestedEventPayload) {}
}

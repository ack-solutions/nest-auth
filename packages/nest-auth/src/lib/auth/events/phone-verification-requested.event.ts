import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthOTP } from '../entities/otp.entity';

export interface PhoneVerificationRequestedEventPayload {
    user: NestAuthUser;
    tenantId?: string;
    otp: NestAuthOTP;
    /** Plaintext verification code for SMS (entity stores hash). */
    code: string;
}

export class PhoneVerificationRequestedEvent {
    constructor(public readonly payload: PhoneVerificationRequestedEventPayload) {}
}

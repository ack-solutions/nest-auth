import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthOTP } from '../entities/otp.entity';
import type { PasswordlessChannel } from '@ackplus/nest-auth-contracts';

export interface PasswordlessCodeRequestedEventPayload {
    user: NestAuthUser;
    tenantId?: string;
    channel: PasswordlessChannel;
    otp: NestAuthOTP;
    /** Plaintext code for email templates or SMS */
    code: string;
}

export class PasswordlessCodeRequestedEvent {
    constructor(public readonly payload: PasswordlessCodeRequestedEventPayload) {}
}

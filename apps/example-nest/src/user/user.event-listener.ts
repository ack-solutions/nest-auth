import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NestAuthEvents } from '@ackplus/nest-auth';
import type {
    UserRegisteredEventPayload,
    UserLoggedInEventPayload,
    PasswordlessCodeRequestedEventPayload,
    UserRegisteredEvent,
} from '@ackplus/nest-auth';
import { UserService } from './user.service';

type SignupInputWithMetadata = {
    metadata?: {
        firstName?: string;
        lastName?: string;
        gender?: string;
        dob?: string;
    };
};

@Injectable()
export class UserEventListener {
    constructor(private readonly userService: UserService) {}

    @OnEvent(NestAuthEvents.REGISTERED)
    async onRegistered(event: UserRegisteredEvent) {
        const payload = event.payload as UserRegisteredEventPayload;
        const authUserId = payload.user.id;
        const input = payload.input as unknown as SignupInputWithMetadata;
        // Keep the consumer's `app_users` table in sync with every new auth user.
        await this.userService.upsertFromSignup(authUserId, input.metadata);
    }

    @OnEvent(NestAuthEvents.PASSWORDLESS_CODE_REQUESTED)
    async onPasswordlessCodeRequested(payload: PasswordlessCodeRequestedEventPayload) {
        const authUserId = payload?.user?.id;
        const metadata = payload?.user?.metadata as any;
        await this.userService.ensureFromAuthUserMetadata(authUserId, metadata);
    }
}



import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NestAuthEvents } from '../../auth.constants';
import { UserUpdatedEvent } from '../../user/events/user-updated.event';
import { UserDeletedEvent } from '../../user/events/user-deleted.event';
import { SessionManagerService } from '../../session/services/session-manager.service';
import { DebugLoggerService } from '../../core/services/debug-logger.service';

/**
 * Listens to user events and manages session validity.
 * For example, revokes sessions when a user is deactivated or deleted.
 */
@Injectable()
export class AuthSessionEventListener {
    constructor(
        private readonly sessionManager: SessionManagerService,
        private readonly debugLogger: DebugLoggerService,
    ) { }

    @OnEvent(NestAuthEvents.USER_UPDATED)
    async handleUserUpdated(event: UserUpdatedEvent) {
        const { user, updatedFields } = event.payload;

        // If isActive status changed to false, revoke all sessions
        if (updatedFields.includes('isActive') && user.isActive === false) {
            this.debugLogger.info('User deactivated. Revoking all sessions.', 'AuthSessionEventListener', { userId: user.id });
            await this.sessionManager.revokeAllUserSessions(user.id);
        }
    }

    @OnEvent(NestAuthEvents.USER_DELETED)
    async handleUserDeleted(event: UserDeletedEvent) {
        const { user } = event.payload;
        this.debugLogger.info('User deleted. Revoking all sessions.', 'AuthSessionEventListener', { userId: user.id });
        await this.sessionManager.revokeAllUserSessions(user.id);
    }
}

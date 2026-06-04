import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NestAuthUser } from '../../user/entities/user.entity';
import { SessionManagerService } from '../../session/services/session-manager.service';
import { RequestContext } from '../../request-context/request-context';
import { NestAuthEvents } from '../../auth.constants';
import { LoggedOutEvent } from '../events/logged-out.event';
import { LoggedOutAllEvent } from '../events/logged-out-all.event';

export type LogoutType = 'user' | 'admin' | 'system';

/**
 * Owns logout + logout-all. Extracted from the (formerly 1226-LOC) AuthService
 * as part of the Phase-2 god-service split (T-040..T-047). AuthService keeps
 * thin delegating facade methods so the public API is unchanged.
 */
@Injectable()
export class LogoutService {
    constructor(
        @InjectRepository(NestAuthUser)
        private readonly userRepository: Repository<NestAuthUser>,
        private readonly sessionManager: SessionManagerService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    /**
     * Revoke the current request's session and emit `LOGGED_OUT`.
     * Idempotent — no session in context is a no-op that still resolves true.
     */
    async logout(logoutType: LogoutType = 'user', reason?: string): Promise<boolean> {
        const session = RequestContext.currentSession();
        const user = await RequestContext.currentUser();

        if (session) {
            await this.eventEmitter.emitAsync(
                NestAuthEvents.LOGGED_OUT,
                new LoggedOutEvent({
                    user,
                    tenantId: session?.data?.tenantId ?? (user as any)?.tenantId,
                    session,
                    logoutType,
                    reason,
                }),
            );

            await this.sessionManager.revokeSession(session.id, 'logout');
        }

        return true;
    }

    /**
     * Revoke ALL sessions for a user and emit `LOGGED_OUT_ALL`.
     */
    async logoutAll(userId: string, logoutType: LogoutType = 'user', reason?: string): Promise<boolean> {
        const sessions = await this.sessionManager.getUserSessions(userId);

        await this.sessionManager.revokeAllUserSessions(userId);

        const user = await this.userRepository.findOne({ where: { id: userId } });

        if (user) {
            await this.eventEmitter.emitAsync(
                NestAuthEvents.LOGGED_OUT_ALL,
                new LoggedOutAllEvent({
                    user,
                    tenantId: RequestContext.currentTenantId(),
                    logoutType,
                    reason,
                    sessions,
                }),
            );
        }

        return true;
    }
}

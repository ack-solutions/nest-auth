import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { NestAuthEvents } from '../../auth.constants';
import { UserLoggedInEvent } from '../../auth/events/user-logged-in.event';
import { LoggedOutEvent } from '../../auth/events/logged-out.event';
import { UserRegisteredEvent } from '../../auth/events/user-registered.event';
import { UserPasswordChangedEvent } from '../../auth/events/user-password-changed.event';
import { User2faEnabledEvent } from '../../auth/events/user-2fa-enabled.event';
import { User2faDisabledEvent } from '../../auth/events/user-2fa-disabled.event';
import { AuthAuditEvent } from '../../core/interfaces/auth-module-options.interface';

@Injectable()
export class AuditService {
    private readonly logger = new Logger(AuditService.name);

    constructor(
        private readonly authConfigService: AuthConfigService,
    ) { }

    private async emitAuditEvent(event: AuthAuditEvent): Promise<void> {
        const config = this.authConfigService.getConfig();

        if (config.audit?.enabled === false) {
            return;
        }

        if (config.audit?.onEvent) {
            try {
                await config.audit.onEvent(event);
            } catch (error) {
                this.logger.error(`Error in audit.onEvent hook: ${error.message}`, error.stack);
            }
        }
    }

    @OnEvent(NestAuthEvents.LOGGED_IN)
    async handleUserLoggedIn(payload: UserLoggedInEvent) {
        await this.emitAuditEvent({
            type: 'login',
            userId: payload.payload.user.id,
            ip: payload.payload.session.ipAddress,
            userAgent: payload.payload.session.userAgent,
            success: true,
            metadata: {
                provider: payload.payload.provider,
                tenantId: payload.payload.tenantId,
            },
            timestamp: new Date(),
        });
    }

    @OnEvent(NestAuthEvents.LOGGED_OUT)
    async handleUserLoggedOut(payload: LoggedOutEvent) {
        await this.emitAuditEvent({
            type: 'logout',
            userId: payload.payload.user?.id,
            success: true,
            metadata: {
                reason: payload.payload.reason,
                sessionId: payload.payload.session.id,
            },
            timestamp: new Date(),
        });
    }

    @OnEvent(NestAuthEvents.REGISTERED)
    async handleUserRegistered(payload: UserRegisteredEvent) {
        await this.emitAuditEvent({
            type: 'signup',
            userId: payload.payload.user.id,
            success: true,
            metadata: {
                tenantId: payload.payload.tenantId,
                provider: payload.payload.provider,
            },
            timestamp: new Date(),
        });
    }

    @OnEvent(NestAuthEvents.PASSWORD_CHANGED)
    async handlePasswordChanged(payload: UserPasswordChangedEvent) {
        await this.emitAuditEvent({
            type: 'password_change',
            userId: payload.payload.user.id,
            success: true,
            metadata: {
                initiatedBy: payload.payload.initiatedBy,
            },
            timestamp: new Date(),
        });
    }

    @OnEvent(NestAuthEvents.TWO_FACTOR_ENABLED)
    async handle2faEnabled(payload: User2faEnabledEvent) {
        await this.emitAuditEvent({
            type: 'mfa_enable',
            userId: payload.payload.user.id,
            success: true,
            metadata: {
                method: payload.payload.method,
                action: 'enabled'
            },
            timestamp: new Date(),
        });
    }

    @OnEvent(NestAuthEvents.TWO_FACTOR_DISABLED)
    async handle2faDisabled(payload: User2faDisabledEvent) {
        await this.emitAuditEvent({
            type: 'mfa_enable', // reusing type or should add mfa_disable?
            userId: payload.payload.user.id,
            success: true,
            metadata: {
                action: 'disabled'
            },
            timestamp: new Date(),
        });
    }
}

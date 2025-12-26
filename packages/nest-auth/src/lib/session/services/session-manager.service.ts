import { Injectable, Inject, Logger, UnauthorizedException } from '@nestjs/common';
import { ISessionRepository } from '../interfaces/session-repository.interface';
import { NestAuthSession } from '../entities/session.entity';
import { IAuthModuleOptions } from '../../core/interfaces/auth-module-options.interface';
import { SessionPayload, SessionDataPayload } from '../../core/interfaces/token-payload.interface';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { RequestContext } from '../../request-context/request-context';
import { NestAuthUser } from '../../user/entities/user.entity';
import { v4 as uuidv4 } from 'uuid';
import ms from 'ms';

export const SESSION_REPOSITORY = 'SESSION_REPOSITORY';

/**
 * High-level session manager
 * Handles session lifecycle using repository pattern
 */
@Injectable()
export class SessionManagerService {
    constructor(
        @Inject(SESSION_REPOSITORY)
        private readonly repository: ISessionRepository,
    ) { }

    private get options(): IAuthModuleOptions {
        return AuthConfigService.getOptions();
    }

    private get maxSessionsPerUser(): number {
        return this.options.session?.maxSessionsPerUser || 10;
    }

    private get slidingExpiration(): boolean {
        return this.options.session?.slidingExpiration ?? true;
    }

    /**
     * Create a new session
     */
    async createSession(payload: {
        userId: string;
        refreshToken?: string;
        data?: any;
        userAgent?: string;
        deviceName?: string;
        ipAddress?: string;
    }): Promise<NestAuthSession> {
        const { userId, refreshToken, data, userAgent, deviceName, ipAddress } = payload;

        // Check max sessions limit
        await this.enforceMaxSessions(userId);

        const sessionPayload: SessionPayload = {
            id: uuidv4(),
            userId,
            refreshToken: refreshToken || '',
            data: data || {},
            expiresAt: this.calculateExpiration(),
            userAgent: userAgent || RequestContext.currentRequest()?.headers['user-agent'] || 'Unknown',
            deviceName: deviceName || RequestContext.getDeviceInfo().deviceName,
            ipAddress: ipAddress || RequestContext.getDeviceInfo().ipAddress,
            lastActive: new Date(),
        };

        const session = await this.repository.create(sessionPayload);

        // Apply onCreated hook if configured
        if (this.options.session?.onCreated) {
            // We need to pass the user object if available.
            // The payload might have data.user if it came from createSessionFromUser
            const user = data?.user;
            await this.options.session.onCreated(session, user);
        }

        return session;
    }

    /**
     * Get session by ID and optionally refresh it
     */
    async getSession(sessionId: string, refreshSession = true): Promise<NestAuthSession> {
        const session = await this.repository.findById(sessionId);

        if (!session) {
            throw new UnauthorizedException('Session not found');
        }

        // Check if expired
        if (this.isExpired(session)) {
            await this.repository.delete(sessionId);
            throw new UnauthorizedException('Session expired');
        }

        // Update last active if sliding expiration enabled
        if (refreshSession && this.slidingExpiration) {
            await this.repository.updateLastActive(sessionId);
        }

        return session;
    }

    /**
     * Get all sessions for a user
     */
    async getUserSessions(userId: string): Promise<NestAuthSession[]> {
        return await this.repository.findByUserId(userId);
    }

    /**
     * Get active sessions for a user
     */
    async getActiveSessions(userId: string): Promise<NestAuthSession[]> {
        return await this.repository.findActiveByUserId(userId);
    }

    /**
     * Update session data
     */
    async updateSession(sessionId: string, updates: Partial<NestAuthSession>): Promise<NestAuthSession> {
        return await this.repository.update(sessionId, updates);
    }

    /**
     * Revoke (delete) a session
     */
    async revokeSession(sessionId: string): Promise<void> {
        // Get session before deleting to pass to hook
        let session: NestAuthSession | null = null;
        if (this.options.session?.onRevoked) {
            session = await this.repository.findById(sessionId);
        }

        await this.repository.delete(sessionId);

        // Apply onRevoked hook if configured
        if (this.options.session?.onRevoked && session) {
            await this.options.session.onRevoked(session, 'admin'); // Default reason, could be passed as arg
        }
    }

    /**
     * Revoke all sessions for a user
     */
    async revokeAllUserSessions(userId: string): Promise<void> {
        await this.repository.deleteByUserId(userId);
    }

    /**
     * Revoke all sessions except the current one
     */
    async revokeOtherSessions(userId: string, currentSessionId: string): Promise<void> {
        const sessions = await this.repository.findByUserId(userId);

        for (const session of sessions) {
            if (session.id !== currentSessionId) {
                await this.repository.delete(session.id);
            }
        }
    }

    /**
     * Clean up expired sessions
     */
    async cleanupExpiredSessions(): Promise<number> {
        return await this.repository.deleteExpired();
    }

    /**
     * Extend session expiration
     */
    async extendSession(sessionId: string, duration?: string): Promise<NestAuthSession> {
        const expiresAt = this.calculateExpiration(duration);
        return await this.repository.update(sessionId, { expiresAt } as any);
    }

    /**
     * Validate session and return it if valid
     */
    async validateSession(sessionId: string): Promise<NestAuthSession | null> {
        try {
            return await this.getSession(sessionId, true);
        } catch {
            return null;
        }
    }

    /**
     * Check if user has reached max sessions limit
     */
    async hasReachedMaxSessions(userId: string): Promise<boolean> {
        const count = await this.repository.countActiveByUserId(userId);
        return count >= this.maxSessionsPerUser;
    }

    /**
     * Enforce max sessions per user by removing oldest sessions
     */
    private async enforceMaxSessions(userId: string): Promise<void> {
        const activeSessions = await this.repository.findActiveByUserId(userId);

        if (activeSessions.length >= this.maxSessionsPerUser) {
            // Sort by lastActive (oldest first)
            const sorted = activeSessions.sort((a, b) => {
                const aTime = a.lastActive?.getTime() || 0;
                const bTime = b.lastActive?.getTime() || 0;
                return aTime - bTime;
            });

            // Remove oldest session(s)
            const toRemove = sorted.slice(0, activeSessions.length - this.maxSessionsPerUser + 1);
            for (const session of toRemove) {
                await this.repository.delete(session.id);
            }
        }
    }

    /**
     * Calculate session expiration date
     */
    private calculateExpiration(duration?: string): Date {
        const expiryDuration = duration || this.options.session?.sessionExpiry || '7d';
        const milliseconds = ms(expiryDuration);
        return new Date(Date.now() + milliseconds);
    }

    /**
     * Check if session is expired
     */
    private isExpired(session: NestAuthSession): boolean {
        if (!session.expiresAt) return false;
        return new Date() > new Date(session.expiresAt);
    }

    /**
     * Create session from user (helper method from old BaseSessionService)
     * For backward compatibility with AuthService
     */
    async createSessionFromUser(user: NestAuthUser, extraData: { isMfaVerified?: boolean } = {}): Promise<NestAuthSession> {
        const { deviceName, ipAddress, browser } = RequestContext.getDeviceInfo();
        const { isMfaVerified = false } = extraData;

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        const roles = await user.getRoles();
        const permissions = await user.getPermissions();

        // Build default session data
        let sessionData: SessionDataPayload = {
            user,
            isMfaVerified,
            roles,
            permissions,
        };

        // Apply custom session data hook if configured
        if (this.options.session?.customizeSessionData) {
            sessionData = await this.options.session.customizeSessionData(sessionData, user);
        }

        // Create session using createSession method
        return await this.createSession({
            userId: user.id,
            data: sessionData,
            userAgent: [browser, deviceName].join(' - '),
            ipAddress,
            deviceName,
        });
    }

    /**
     * Refresh an existing session
     * Updates expiration and last active time
     */
    async refreshSession(session: NestAuthSession): Promise<NestAuthSession> {
        const updates: Partial<NestAuthSession> = {
            expiresAt: this.calculateExpiration(),
            lastActive: new Date(),
        };

        // Apply onRefreshed hook if configured
        if (this.options.session?.onRefreshed) {
            // We need to pass the old session (current state) and the new session (future state)
            // Since we are updating in place, we can construct the "new" session object for the hook
            const newSession = { ...session, ...updates } as NestAuthSession;
            await this.options.session.onRefreshed(session, newSession);
        }

        return await this.updateSession(session.id, updates);
    }

    /**
     * Get current active sessions for a user
     * For backward compatibility with AuthService
     */
    async getCurrentSessions(userId: string): Promise<NestAuthSession[]> {
        return await this.getActiveSessions(userId);
    }
}

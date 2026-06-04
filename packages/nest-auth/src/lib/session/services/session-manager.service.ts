import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { SessionStore } from '../interfaces/session-store.interface';
import { NestAuthSession } from '../entities/session.entity';
import { IAuthModuleOptions } from '../../core/interfaces/auth-module-options.interface';
import { SessionPayload, SessionDataPayload } from '../../core/interfaces/token-payload.interface';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { RequestContext } from '../../request-context/request-context';
import { NestAuthUser } from '../../user/entities/user.entity';
import { v4 as uuidv4 } from 'uuid';
import ms from 'ms';
import { getRolePermissionNames, mapRoleToSessionSnapshot } from '../../role/utils/role-mapper.util';
import { AccessRoleResolver } from '../../role/utils/access-role-resolver.util';
import { NestAuthRole } from '../../role/entities/role.entity';
import { NestAuthUserAccess } from '../../user/entities/user-access.entity';
import { chain } from 'lodash';
import { NestAuthPlatformAccess } from '../../user/entities/platform-access.entity';

export const SESSION_STORE = 'SESSION_STORE';
export const SESSION_REPOSITORY = 'SESSION_REPOSITORY';

/**
 * High-level session manager
 * Handles session lifecycle using repository pattern
 */
@Injectable()
export class SessionManagerService {
    constructor(
        @Inject(SESSION_STORE)
        private readonly store: SessionStore,
    ) { }

    private get options(): IAuthModuleOptions {
        return AuthConfigService.getOptions();
    }

    private get maxSessionsPerUser(): number {
        return this.options.session?.maxSessionsPerUser || 10;
    }

    private get slidingExpiration(): boolean {
        return this.options.session?.slidingExpiration ?? false;
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

        const session = await this.store.create(sessionPayload);

        // Apply onCreated hook if configured
        if (this.options.session?.onCreated) {
            // We need to pass the user object if available.
            // The payload might have data.user if it came from createSessionFromUser
            const user = data?.user;
            await this.options.session.onCreated(session, user);
        }

        return session;
    }

    private shouldTouchSession(session: NestAuthSession): boolean {
        const now = Date.now();
        const lastActive = session.lastActive ? new Date(session.lastActive).getTime() : 0;

        const touchedRecently = now - lastActive < this.getTouchIntervalMs();

        return !touchedRecently;
    }

    private getTouchIntervalMs(): number {
        const raw = this.options.session?.touchInterval ?? '5m';
        // Use the same path as the rest of the library (see utils/date.util.ts).
        // ms() typings vary by version; the cast keeps us version-tolerant.
        return typeof raw === 'string' ? ms(raw as any) : raw;
    }

    /**
     * Get session by ID and optionally refresh it
     */
    async getSession(sessionId: string): Promise<NestAuthSession> {
        const session = await this.store.findById(sessionId);

        if (!session) {
            throw new UnauthorizedException('Session not found');
        }

        // Enforce server-side session expiry (HIPAA/idle + absolute timeout).
        if (this.isExpired(session)) {
            await this.store.delete(sessionId);
            throw new UnauthorizedException('Session expired');
        }
        // Update last active if sliding expiration enabled
        if (this.slidingExpiration && this.shouldTouchSession(session)) {
            const updatedSession = await this.touchSession(sessionId);
            return updatedSession;
        }

        return session;
    }

    /**
     * Get all sessions for a user
     */
    async getUserSessions(userId: string): Promise<NestAuthSession[]> {
        return await this.store.findByUserId(userId);
    }

    /**
     * Get active sessions for a user
     */
    async getActiveSessions(userId: string): Promise<NestAuthSession[]> {
        return await this.store.findActiveByUserId(userId);
    }

    /**
     * Update session data
     */
    async updateSession(sessionId: string, updates: Partial<NestAuthSession>): Promise<NestAuthSession> {
        return await this.store.update(sessionId, updates);
    }

    /**
     * Revoke (delete) a session.
     *
     * @param sessionId - Session to revoke.
     * @param reason    - Why it's being revoked. Surfaced to the
     *                    `session.onRevoked(session, reason)` hook so audit
     *                    consumers can aggregate by cause. Defaults to
     *                    `'admin'` for backward compatibility with callers
     *                    that haven't been updated to specify.
     */
    async revokeSession(
        sessionId: string,
        reason: 'logout' | 'expired' | 'admin' | 'security' | 'password_change' = 'admin',
    ): Promise<void> {
        // Get session before deleting to pass to hook
        let session: NestAuthSession | null = null;
        if (this.options.session?.onRevoked) {
            session = await this.store.findById(sessionId);
        }

        await this.store.delete(sessionId);

        // Apply onRevoked hook if configured
        if (this.options.session?.onRevoked && session) {
            await this.options.session.onRevoked(session, reason);
        }
    }

    /**
     * Delete a session (alias for revokeSession).
     */
    async deleteSession(
        sessionId: string,
        reason: 'logout' | 'expired' | 'admin' | 'security' | 'password_change' = 'admin',
    ): Promise<void> {
        await this.revokeSession(sessionId, reason);
    }

    /**
     * Revoke all sessions for a user
     */
    async revokeAllUserSessions(userId: string): Promise<void> {
        await this.store.deleteByUserId(userId);
    }

    /**
     * Revoke all sessions except the current one
     */
    async revokeOtherSessions(userId: string, currentSessionId: string): Promise<void> {
        const sessions = await this.store.findByUserId(userId);

        for (const session of sessions) {
            if (session.id !== currentSessionId) {
                await this.store.delete(session.id);
            }
        }
    }

    /**
     * Clean up expired sessions
     */
    async cleanupExpiredSessions(): Promise<number> {
        return await this.store.deleteExpired();
    }


    /**
     * Touch session (update last active and extend expiry)
     */
    async touchSession(sessionId: string): Promise<NestAuthSession> {
        const expiresAt = this.calculateExpiration();
        return await this.store.update(sessionId, {
            lastActive: new Date(),
            expiresAt,
        } as any);
    }

    /**
     * Rotate session ID (prevent fixation)
     */
    async rotateSession(sessionId: string): Promise<NestAuthSession> {
        const session = await this.store.findById(sessionId);
        if (!session) {
            throw new UnauthorizedException('Session not found');
        }

        const newSessionPayload: SessionPayload = {
            id: uuidv4(),
            userId: session.userId,
            refreshToken: session.refreshToken,
            data: session.data,
            expiresAt: this.calculateExpiration(),
            userAgent: session.userAgent,
            deviceName: session.deviceName,
            ipAddress: session.ipAddress,
            lastActive: new Date(),
        };

        const newSession = await this.store.create(newSessionPayload);
        await this.store.delete(sessionId);

        if (this.options.session?.onRevoked) {
            await this.options.session.onRevoked(session as any, 'security');
        }

        return newSession;
    }

    /**
     * Validate session and return it if valid
     */
    async validateSession(sessionId: string): Promise<NestAuthSession | null> {
        try {
            return await this.getSession(sessionId);
        } catch {
            return null;
        }
    }

    /**
     * Check if user has reached max sessions limit
     */
    async hasReachedMaxSessions(userId: string): Promise<boolean> {
        const count = await this.store.countActiveByUserId(userId);
        return count >= this.maxSessionsPerUser;
    }

    /**
     * Enforce max sessions per user by removing oldest sessions
     */
    private async enforceMaxSessions(userId: string): Promise<void> {
        const activeSessions = await this.store.findActiveByUserId(userId);

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
                await this.store.delete(session.id);
            }
        }
    }

    /**
     * Calculate session expiration date
     */
    private calculateExpiration(): Date {
        const expiryDuration = this.options.session?.refreshTokenValidity;

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
    async createSessionFromUser(
        user: NestAuthUser,
        userAccess: NestAuthUserAccess,
        extraData: { isMfaVerified?: boolean; tenantId?: string | null; isPlatformAccess?: boolean; platformAccess?: NestAuthPlatformAccess } = {}
    ): Promise<NestAuthSession> {
        const { deviceName, ipAddress, browser } = RequestContext.getDeviceInfo();
        const { isMfaVerified = false, tenantId = null, isPlatformAccess } = extraData;

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        let roles: NestAuthRole[] = [];
        let permissions: string[] = [];

        if (isPlatformAccess) {
            roles = extraData?.platformAccess?.roles ?? [];
        } else {
            roles = userAccess?.roles ?? [];
           
        }
        permissions = chain(roles)
            .map((role: any) => getRolePermissionNames(role))
            .flatten()
            .uniq()
            .value();

        // Build default session data
        let sessionData: SessionDataPayload = {
            user,
            isMfaVerified,
            roles: roles.map((role) => mapRoleToSessionSnapshot(role)),
            permissions,
            tenantId,
            isPlatformAccess: isPlatformAccess ?? false,
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

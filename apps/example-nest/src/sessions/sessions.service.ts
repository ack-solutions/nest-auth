/**
 * Sessions Service
 * 
 * Business logic for session management.
 * Follows the thin-controller, fat-service pattern.
 * 
 * This service wraps nest-auth's SessionManagerService to provide:
 * - Session listing with device/location info
 * - Session revocation with validation
 * - Bulk session operations
 */

import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { SessionManagerService, NestAuthSession, SESSION_REPOSITORY } from '@ackplus/nest-auth';
import { SessionResponseDto, SessionListResponseDto, RevokeSessionResponseDto } from './dto/session.dto';

@Injectable()
export class SessionsService {
    constructor(
        /**
         * SessionManagerService from nest-auth
         * Provides low-level session operations
         */
        private readonly sessionManager: SessionManagerService,
    ) { }

    /**
     * Get all active sessions for a user
     * 
     * Returns sessions with device info and activity timestamps.
     * Marks the current session for UI differentiation.
     * 
     * @param userId - User ID to get sessions for
     * @param currentSessionId - Current session ID to mark as 'current'
     * @returns List of sessions with metadata
     */
    async getUserSessions(userId: string, currentSessionId: string): Promise<SessionListResponseDto> {
        // Get active sessions from nest-auth
        const sessions = await this.sessionManager.getActiveSessions(userId);

        // Transform to response DTOs with additional metadata
        const sessionDtos: SessionResponseDto[] = sessions.map((session) => ({
            id: session.id,
            deviceName: session.deviceName || this.parseDeviceName(session.userAgent),
            userAgent: session.userAgent,
            ipAddress: session.ipAddress,
            lastActiveAt: session.lastActive,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
            isCurrent: session.id === currentSessionId,
            // Parse browser/OS from user agent for display
            browser: this.parseBrowser(session.userAgent),
            os: this.parseOS(session.userAgent),
        }));

        // Sort: current session first, then by last active
        sessionDtos.sort((a, b) => {
            if (a.isCurrent) return -1;
            if (b.isCurrent) return 1;
            return new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime();
        });

        return {
            sessions: sessionDtos,
            count: sessionDtos.length,
        };
    }

    /**
     * Revoke a specific session
     * 
     * Security considerations:
     * - Users can only revoke their own sessions
     * - Cannot revoke current session via this method (use logout instead)
     * 
     * @param sessionId - Session to revoke
     * @param userId - Current user's ID for ownership validation
     * @param currentSessionId - To prevent revoking current session
     * @returns Confirmation response
     */
    async revokeSession(
        sessionId: string,
        userId: string,
        currentSessionId: string,
    ): Promise<RevokeSessionResponseDto> {
        // Prevent revoking current session
        if (sessionId === currentSessionId) {
            throw new ForbiddenException({
                message: 'Cannot revoke current session. Use logout instead.',
                code: 'CANNOT_REVOKE_CURRENT_SESSION',
            });
        }

        // Verify session exists and belongs to user
        const session = await this.sessionManager.getSession(sessionId, false);

        if (!session) {
            throw new NotFoundException({
                message: 'Session not found',
                code: 'SESSION_NOT_FOUND',
            });
        }

        if (session.userId !== userId) {
            throw new ForbiddenException({
                message: 'You can only revoke your own sessions',
                code: 'SESSION_OWNERSHIP_REQUIRED',
            });
        }

        // Revoke the session
        await this.sessionManager.revokeSession(sessionId);

        return {
            message: 'Session revoked successfully',
            sessionId,
        };
    }

    /**
     * Revoke all sessions except current
     * 
     * Useful for security when user suspects account compromise.
     * Keeps current session active for continued use.
     * 
     * @param userId - User ID to revoke sessions for
     * @param currentSessionId - Session to keep active
     * @returns Count of revoked sessions
     */
    async revokeAllOtherSessions(
        userId: string,
        currentSessionId: string,
    ): Promise<RevokeSessionResponseDto> {
        // Get all sessions first to count
        const sessions = await this.sessionManager.getActiveSessions(userId);
        const otherSessions = sessions.filter((s) => s.id !== currentSessionId);
        const count = otherSessions.length;

        // Revoke all except current
        await this.sessionManager.revokeOtherSessions(userId, currentSessionId);

        return {
            message: `${count} session(s) revoked successfully`,
            revokedCount: count,
        };
    }

    /**
     * Revoke ALL sessions including current
     * 
     * Nuclear option - logs user out of everything.
     * Used for password changes or suspected breach.
     * 
     * @param userId - User ID to revoke all sessions for
     * @returns Confirmation response
     */
    async revokeAllSessions(userId: string): Promise<RevokeSessionResponseDto> {
        // Get count for response
        const sessions = await this.sessionManager.getActiveSessions(userId);
        const count = sessions.length;

        // Revoke all sessions
        await this.sessionManager.revokeAllUserSessions(userId);

        return {
            message: `All ${count} session(s) revoked. You will be logged out.`,
            revokedCount: count,
        };
    }

    // ============================================================================
    // Private Helper Methods
    // ============================================================================

    /**
     * Parse device name from user agent string
     * Falls back to generic names if parsing fails
     */
    private parseDeviceName(userAgent?: string): string {
        if (!userAgent) return 'Unknown Device';

        // Simple device detection - could be enhanced with ua-parser-js
        if (userAgent.includes('Mobile')) {
            if (userAgent.includes('iPhone')) return 'iPhone';
            if (userAgent.includes('iPad')) return 'iPad';
            if (userAgent.includes('Android')) return 'Android Device';
            return 'Mobile Device';
        }

        if (userAgent.includes('Macintosh')) return 'Mac';
        if (userAgent.includes('Windows')) return 'Windows PC';
        if (userAgent.includes('Linux')) return 'Linux';

        return 'Desktop';
    }

    /**
     * Parse browser name from user agent
     */
    private parseBrowser(userAgent?: string): string {
        if (!userAgent) return 'Unknown';

        if (userAgent.includes('Edg')) return 'Edge';
        if (userAgent.includes('Chrome')) return 'Chrome';
        if (userAgent.includes('Firefox')) return 'Firefox';
        if (userAgent.includes('Safari')) return 'Safari';
        if (userAgent.includes('Opera')) return 'Opera';

        return 'Unknown';
    }

    /**
     * Parse OS name from user agent
     */
    private parseOS(userAgent?: string): string {
        if (!userAgent) return 'Unknown';

        if (userAgent.includes('Windows NT 10')) return 'Windows 10';
        if (userAgent.includes('Windows NT 11')) return 'Windows 11';
        if (userAgent.includes('Windows')) return 'Windows';
        if (userAgent.includes('Mac OS X')) return 'macOS';
        if (userAgent.includes('Android')) return 'Android';
        if (userAgent.includes('iOS') || userAgent.includes('iPhone')) return 'iOS';
        if (userAgent.includes('Linux')) return 'Linux';

        return 'Unknown';
    }
}

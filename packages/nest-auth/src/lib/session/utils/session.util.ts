import { NestAuthSession } from '../entities/session.entity';
import { SessionPayload } from '../../core/interfaces/token-payload.interface';
import ms from 'ms';

/**
 * Session utility functions
 */
export class SessionUtil {
    /**
     * Extract session metadata (device, location, etc.)
     */
    static extractMetadata(session: NestAuthSession): {
        device: string;
        ip: string;
        location?: string;
        browser?: string;
        os?: string;
    } {
        return {
            device: session.deviceName || 'Unknown Device',
            ip: session.ipAddress || 'Unknown IP',
            // Can be extended with geo-location, browser detection, etc.
        };
    }

    /**
     * Calculate remaining session time
     */
    static getRemainingTime(session: NestAuthSession): {
        milliseconds: number;
        seconds: number;
        minutes: number;
        hours: number;
        formatted: string;
    } {
        if (!session.expiresAt) {
            return {
                milliseconds: 0,
                seconds: 0,
                minutes: 0,
                hours: 0,
                formatted: 'Never',
            };
        }

        const now = Date.now();
        const expiresAt = new Date(session.expiresAt).getTime();
        const remaining = Math.max(0, expiresAt - now);

        const seconds = Math.floor(remaining / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        return {
            milliseconds: remaining,
            seconds,
            minutes,
            hours,
            formatted: ms(remaining, { long: true }),
        };
    }

    /**
     * Check if session is about to expire (within threshold)
     */
    static isExpiringSoon(session: NestAuthSession, thresholdMs: number = 5 * 60 * 1000): boolean {
        const remaining = this.getRemainingTime(session);
        return remaining.milliseconds > 0 && remaining.milliseconds < thresholdMs;
    }

    /**
     * Check if session is expired
     */
    static isExpired(session: NestAuthSession): boolean {
        if (!session.expiresAt) return false;
        return new Date() > new Date(session.expiresAt);
    }

    /**
     * Check if session is active (not expired)
     */
    static isActive(session: NestAuthSession): boolean {
        return !this.isExpired(session);
    }

    /**
     * Format session for display
     */
    static formatForDisplay(session: NestAuthSession): {
        id: string;
        device: string;
        ipAddress: string;
        lastActive: string;
        expiresAt: string;
        isActive: boolean;
        isCurrent?: boolean;
    } {
        return {
            id: session.id,
            device: session.deviceName || 'Unknown',
            ipAddress: session.ipAddress || 'Unknown',
            lastActive: session.lastActive
                ? new Date(session.lastActive).toLocaleString()
                : 'Unknown',
            expiresAt: session.expiresAt
                ? new Date(session.expiresAt).toLocaleString()
                : 'Never',
            isActive: this.isActive(session),
        };
    }

    /**
     * Sanitize session data (remove sensitive information)
     */
    static sanitize(session: NestAuthSession): Partial<NestAuthSession> {
        const { refreshToken, data, ...sanitized } = session;
        return sanitized;
    }

    /**
     * Compare two sessions
     */
    static isSameDevice(session1: NestAuthSession, session2: NestAuthSession): boolean {
        return (
            session1.deviceName === session2.deviceName &&
            session1.userAgent === session2.userAgent &&
            session1.ipAddress === session2.ipAddress
        );
    }

    /**
     * Get session age
     */
    static getAge(session: NestAuthSession): {
        milliseconds: number;
        formatted: string;
    } {
        if (!session.createdAt) {
            return { milliseconds: 0, formatted: 'Unknown' };
        }

        const age = Date.now() - new Date(session.createdAt).getTime();
        return {
            milliseconds: age,
            formatted: ms(age, { long: true }),
        };
    }

    /**
     * Get idle time (time since last activity)
     */
    static getIdleTime(session: NestAuthSession): {
        milliseconds: number;
        formatted: string;
    } {
        if (!session.lastActive) {
            return { milliseconds: 0, formatted: 'Unknown' };
        }

        const idle = Date.now() - new Date(session.lastActive).getTime();
        return {
            milliseconds: idle,
            formatted: ms(idle, { long: true }),
        };
    }
}

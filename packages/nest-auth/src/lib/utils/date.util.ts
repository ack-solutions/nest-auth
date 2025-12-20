import ms from 'ms';

/**
 * Date and time utilities
 */
export class DateUtil {
    /**
     * Parse duration string to milliseconds
     */
    static parseDuration(duration: string | number): number {
        if (typeof duration === 'number') {
            return duration;
        }
        return ms(duration);
    }

    /**
     * Add duration to date
     */
    static addDuration(date: Date, duration: string | number): Date {
        const milliseconds = this.parseDuration(duration);
        return new Date(date.getTime() + milliseconds);
    }

    /**
     * Check if date is in the past
     */
    static isPast(date: Date): boolean {
        return date < new Date();
    }

    /**
     * Check if date is in the future
     */
    static isFuture(date: Date): boolean {
        return date > new Date();
    }

    /**
     * Get time remaining until date
     */
    static getTimeUntil(date: Date): {
        milliseconds: number;
        seconds: number;
        minutes: number;
        hours: number;
        days: number;
        formatted: string;
    } {
        const remaining = Math.max(0, date.getTime() - Date.now());
        const seconds = Math.floor(remaining / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        return {
            milliseconds: remaining,
            seconds,
            minutes,
            hours,
            days,
            formatted: ms(remaining, { long: true }),
        };
    }

    /**
     * Format date for display
     */
    static format(date: Date, format: 'short' | 'long' | 'iso' = 'short'): string {
        switch (format) {
            case 'long':
                return date.toLocaleString();
            case 'iso':
                return date.toISOString();
            case 'short':
            default:
                return date.toLocaleDateString();
        }
    }

    /**
     * Get relative time (e.g., "2 hours ago")
     */
    static getRelativeTime(date: Date): string {
        const diff = Date.now() - date.getTime();

        if (diff < 0) {
            return 'in the future';
        }

        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const months = Math.floor(days / 30);
        const years = Math.floor(days / 365);

        if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
        if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        if (seconds > 10) return `${seconds} seconds ago`;
        return 'just now';
    }
}

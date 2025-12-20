/**
 * Device and user-agent utilities
 */
export class DeviceUtil {
    /**
     * Parse user agent string
     */
    static parseUserAgent(userAgent: string): {
        browser: string;
        version: string;
        os: string;
        device: string;
        isMobile: boolean;
        isTablet: boolean;
        isDesktop: boolean;
    } {
        const ua = userAgent.toLowerCase();

        return {
            browser: this.detectBrowser(ua),
            version: this.detectBrowserVersion(ua),
            os: this.detectOS(ua),
            device: this.detectDevice(ua),
            isMobile: this.isMobile(ua),
            isTablet: this.isTablet(ua),
            isDesktop: this.isDesktop(ua),
        };
    }

    /**
     * Detect browser from user agent
     */
    private static detectBrowser(ua: string): string {
        if (ua.includes('edg/')) return 'Edge';
        if (ua.includes('chrome/')) return 'Chrome';
        if (ua.includes('firefox/')) return 'Firefox';
        if (ua.includes('safari/') && !ua.includes('chrome')) return 'Safari';
        if (ua.includes('opera') || ua.includes('opr/')) return 'Opera';
        return 'Unknown';
    }

    /**
     * Detect browser version
     */
    private static detectBrowserVersion(ua: string): string {
        const match = ua.match(/(chrome|firefox|safari|edg|opr)\/(\d+)/);
        return match ? match[2] : 'Unknown';
    }

    /**
     * Detect operating system
     */
    private static detectOS(ua: string): string {
        if (ua.includes('windows nt')) return 'Windows';
        if (ua.includes('mac os x')) return 'macOS';
        if (ua.includes('linux')) return 'Linux';
        if (ua.includes('android')) return 'Android';
        if (ua.includes('iphone') || ua.includes('ipad')) return 'iOS';
        return 'Unknown';
    }

    /**
     * Detect device type
     */
    private static detectDevice(ua: string): string {
        if (ua.includes('iphone')) return 'iPhone';
        if (ua.includes('ipad')) return 'iPad';
        if (ua.includes('android')) return 'Android';
        if (ua.includes('windows phone')) return 'Windows Phone';
        if (ua.includes('macintosh')) return 'Mac';
        if (ua.includes('windows')) return 'Windows PC';
        if (ua.includes('linux')) return 'Linux PC';
        return 'Unknown';
    }

    /**
     * Check if mobile device
     */
    private static isMobile(ua: string): boolean {
        return /mobile|android|iphone|ipod|blackberry|windows phone/i.test(ua);
    }

    /**
     * Check if tablet
     */
    private static isTablet(ua: string): boolean {
        return /ipad|android(?!.*mobile)|tablet/i.test(ua);
    }

    /**
     * Check if desktop
     */
    private static isDesktop(ua: string): boolean {
        return !this.isMobile(ua) && !this.isTablet(ua);
    }

    /**
     * Generate friendly device name
     */
    static getDeviceName(userAgent: string): string {
        const parsed = this.parseUserAgent(userAgent);

        if (parsed.isMobile) {
            return `${parsed.device} (${parsed.browser})`;
        }
        if (parsed.isTablet) {
            return `${parsed.device} Tablet (${parsed.browser})`;
        }
        return `${parsed.os} (${parsed.browser})`;
    }
}

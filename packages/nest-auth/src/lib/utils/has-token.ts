import { createHmac, timingSafeEqual } from 'crypto';

export const SHA256_HEX_LENGTH = 64;

/**
 * Constant-time compare for equal-length hex strings.
 * Returns false if hex is invalid or lengths differ.
 */
export function timingSafeEqualHex(aHex: string, bHex: string): boolean {
    try {
        const a = Buffer.from(aHex, 'hex');
        const b = Buffer.from(bHex, 'hex');
        if (a.length !== b.length) return false;
        return timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

/**
 * HMAC-SHA256(secret, message) as lowercase hex (64 chars).
 */
export function hmacSha256Hex(secret: string, message: string): string {
    return createHmac('sha256', secret).update(message, 'utf8').digest('hex');
}

export function hexPrefix(hex: string, length: number): string {
    return hex.slice(0, length);
}

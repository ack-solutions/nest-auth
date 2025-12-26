/**
 * JWT utilities for token parsing and validation
 * Uses jwt-decode library for reliable cross-environment decoding
 * 
 * Note: These are non-verified decodes only (no signature verification)
 */

import { jwtDecode } from 'jwt-decode';
import { DecodedJwt } from '../types/auth.types';

/**
 * Decode a JWT token without verification
 * 
 * WARNING: This does not verify the token signature!
 * Use this only for reading claims, not for security decisions.
 * 
 * @param token - JWT token string
 * @returns Decoded payload or null if invalid
 */
export function decodeJwt(token: string | null | undefined): DecodedJwt | null {
    if (!token) return null;

    try {
        return jwtDecode<DecodedJwt>(token);
    } catch {
        return null;
    }
}

/**
 * Check if a JWT token is expired
 * 
 * @param token - JWT token string or decoded payload
 * @param thresholdSeconds - Consider expired if within this many seconds of expiry (default: 0)
 * @returns true if expired, false if valid, null if cannot determine
 */
export function isTokenExpired(
    token: string | DecodedJwt | null,
    thresholdSeconds: number = 0
): boolean | null {
    if (!token) return null;

    const decoded = typeof token === 'string' ? decodeJwt(token) : token;

    if (!decoded || !decoded.exp) {
        return null;
    }

    const now = Math.floor(Date.now() / 1000);
    return decoded.exp <= now + thresholdSeconds;
}

/**
 * Get the expiration time from a JWT token
 * 
 * @param token - JWT token string or decoded payload
 * @returns Date object or null if cannot determine
 */
export function getTokenExpirationDate(token: string | DecodedJwt | null): Date | null {
    if (!token) return null;

    const decoded = typeof token === 'string' ? decodeJwt(token) : token;

    if (!decoded || !decoded.exp) {
        return null;
    }

    return new Date(decoded.exp * 1000);
}

/**
 * Get the time in seconds until a token expires
 * 
 * @param token - JWT token string or decoded payload
 * @returns Seconds until expiry, or null if cannot determine. Negative if expired.
 */
export function getTokenTimeToExpiry(token: string | DecodedJwt | null): number | null {
    if (!token) return null;

    const decoded = typeof token === 'string' ? decodeJwt(token) : token;

    if (!decoded || !decoded.exp) {
        return null;
    }

    const now = Math.floor(Date.now() / 1000);
    return decoded.exp - now;
}

/**
 * Extract user ID from a JWT token
 * 
 * @param token - JWT token string or decoded payload
 * @returns User ID or null if not found
 */
export function getUserIdFromToken(token: string | DecodedJwt | null | undefined): string | null {
    if (!token) return null;

    const decoded = typeof token === 'string' ? decodeJwt(token) : token;

    if (!decoded) return null;

    // Common claim names for user ID
    return decoded.userId || decoded.sub || decoded.user_id || null;
}

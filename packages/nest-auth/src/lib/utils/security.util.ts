import { timingSafeEqual, createHash } from 'crypto';

/**
 * Performs a constant-time comparison of two keys to prevent timing attacks.
 * Uses hashing to fixed-length digests to prevent length-dependent timing attacks.
 * This is critical for security-sensitive comparisons like setup keys.
 *
 * @param providedKey - The key provided by the user/client
 * @param expectedKey - The expected key from configuration
 * @returns true if keys match, false otherwise
 */
export function compareKeys(providedKey: string, expectedKey: string): boolean {
    if (!providedKey || !expectedKey) {
        return false;
    }

    try {
        // Hash both keys to fixed-length digests to prevent length-dependent timing attacks
        const providedDigest = createHash('sha256').update(providedKey, 'utf8').digest();
        const expectedDigest = createHash('sha256').update(expectedKey, 'utf8').digest();

        // Compare fixed-length digests using timing-safe comparison
        return timingSafeEqual(providedDigest, expectedDigest);
    } catch {
        return false;
    }
}

import { randomInt } from 'crypto';

// Unambiguous 32-symbol alphabet for alphanumeric codes (Crockford-style:
// omits O/0, I/1/L to avoid transcription errors). Full-alphabet sampling —
// no truncated hex, so a length-N code carries log2(32)*N bits of entropy.
const ALPHANUMERIC_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Generate a one-time code using a CSPRNG (`crypto.randomInt`), NOT `Math.random()`.
 * `Math.random()` is not cryptographically secure — its state can be recovered from
 * a few outputs, which shrinks the effective search space for OTP brute force.
 *
 * Numeric codes are sampled per-digit over 0–9 (uniform, no modulo bias), so a
 * leading zero is possible and the full 10^length space is used. Codes are
 * returned as strings and must be compared as strings (never parsed to a number).
 */
export function generateOtp(length: number = 6, format: 'numeric' | 'alphanumeric' = 'numeric'): string {
    const safeLength = Number.isInteger(length) && length > 0 ? length : 6;

    if (format === 'numeric') {
        let out = '';
        for (let i = 0; i < safeLength; i++) {
            out += randomInt(0, 10).toString();
        }
        return out;
    }

    let out = '';
    for (let i = 0; i < safeLength; i++) {
        out += ALPHANUMERIC_ALPHABET[randomInt(0, ALPHANUMERIC_ALPHABET.length)];
    }
    return out;
}

/**
 * Security utilities for authentication forms
 */

/** 0–100 score: length + character classes (aligned across forms and RHF password field). */
export function getPasswordStrengthScore(password: string): number {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score += 25;
    if (/[A-Z]/.test(password)) score += 15;
    if (/[a-z]/.test(password)) score += 15;
    if (/\d/.test(password)) score += 15;
    if (/[@$!%*?&]/.test(password)) score += 15;
    if (password.length >= 12) score += 15;
    return Math.min(100, score);
}

export type PasswordStrengthCategory = 'weak' | 'medium' | 'strong';

/** Maps score to coarse category (used for colors and legacy bar indicator). */
export function getPasswordStrengthCategory(score: number): PasswordStrengthCategory {
    if (score < 40) return 'weak';
    if (score < 70) return 'medium';
    return 'strong';
}

/** Human-readable label for the current score. */
export function getPasswordStrengthLabel(score: number): string {
    const c = getPasswordStrengthCategory(score);
    if (c === 'weak') return 'Weak';
    if (c === 'medium') return 'Medium';
    return 'Strong';
}

/**
 * Password strength for display (bar / text). Empty input → null.
 */
export const calculatePasswordStrength = (password: string): 'weak' | 'medium' | 'strong' | null => {
    if (!password || password.length === 0) {
        return null;
    }
    return getPasswordStrengthCategory(getPasswordStrengthScore(password));
};

/**
 * Generates a secure random password that meets validation requirements
 * @param length - Desired password length (default: 16, min: 8, max: 128)
 * @returns A secure random password with uppercase, lowercase, numbers, and special characters
 */
export const generateRandomPassword = (length: number = 16): string => {
    // Ensure length is within valid range
    const validLength = Math.max(8, Math.min(length, 128));

    // Character sets
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '@$!%*?&';
    const allChars = uppercase + lowercase + numbers + special;

    // Use crypto.getRandomValues if available (more secure), fallback to Math.random
    // Use rejection sampling to avoid modulo bias
    const getRandomValue = (max: number): number => {
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            let value: number;
            const maxValid = Math.floor(0xFFFFFFFF / max) * max;
            do {
                const array = new Uint32Array(1);
                crypto.getRandomValues(array);
                value = array[0];
            } while (value >= maxValid);
            return value % max;
        }
        return Math.floor(Math.random() * max);
    };

    // Ensure at least one character from each required set
    let password = '';
    password += uppercase[getRandomValue(uppercase.length)];
    password += lowercase[getRandomValue(lowercase.length)];
    password += numbers[getRandomValue(numbers.length)];
    password += special[getRandomValue(special.length)];

    // Fill the rest with random characters
    for (let i = password.length; i < validLength; i++) {
        password += allChars[getRandomValue(allChars.length)];
    }

    // Shuffle the password to avoid predictable pattern
    const passwordArray = password.split('');
    for (let i = passwordArray.length - 1; i > 0; i--) {
        const j = getRandomValue(i + 1);
        [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
    }

    return passwordArray.join('');
};

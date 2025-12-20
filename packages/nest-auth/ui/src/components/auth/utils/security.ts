/**
 * Security utilities for authentication forms
 */

/**
 * Calculates password strength for display
 */
export const calculatePasswordStrength = (password: string): 'weak' | 'medium' | 'strong' | null => {
    if (!password || password.length === 0) {
        return null;
    }

    // Check for required character types
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[@$!%*?&]/.test(password);

    const charVariety = [hasUpperCase, hasLowerCase, hasNumber, hasSpecialChar].filter(Boolean).length;

    if (password.length >= 12 && charVariety === 4) {
        return 'strong';
    } else if (password.length >= 10 || charVariety >= 3) {
        return 'medium';
    }

    return 'weak';
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

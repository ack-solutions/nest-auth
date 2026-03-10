/**
 * Normalize email for case-insensitive storage and lookup.
 * Returns lowercase trimmed string, or null if input is empty/falsy.
 */
export function normalizedEmail(email: string | null | undefined): string | null {
    if (email == null || typeof email !== 'string') return null;
    const value = email.trim().toLowerCase();
    return value === '' ? null : value;
}

/**
 * Normalize phone for consistent storage and lookup.
 * Trims and removes all whitespace (spaces, tabs, etc.).
 * Returns null if input is empty/falsy.
 */
export function normalizedPhone(phone: string | null | undefined): string | null {
    if (phone == null || typeof phone !== 'string') return null;
    const value = phone.trim().replace(/\s+/g, '');
    return value === '' ? null : value;
}

/**
 * Validates if a string is a valid slug
 * Valid format: lowercase letters, numbers, hyphens (-) and underscores (_) only
 * No spaces, no special characters
 *
 * @param slug - The string to validate
 * @returns true if valid, false otherwise
 *
 * @example
 * ```typescript
 * isValidSlug('my-app')        // true
 * isValidSlug('acme_corp')     // true
 * isValidSlug('tenant123')     // true
 * isValidSlug('My-App')        // false (uppercase)
 * isValidSlug('my app')        // false (space)
 * isValidSlug('my@app')        // false (special char)
 * ```
 */
export function isValidSlug(slug: string): boolean {
    if (!slug || typeof slug !== 'string') {
        return false;
    }

    // Only lowercase letters, numbers, hyphens, and underscores
    const slugRegex = /^[a-z0-9_-]+$/;
    return slugRegex.test(slug);
}

/**
 * Converts a string to a valid slug
 * - Converts to lowercase
 * - Replaces spaces with hyphens
 * - Removes invalid characters
 *
 * @param input - The string to convert
 * @returns A valid slug
 *
 * @example
 * ```typescript
 * toSlug('My App')           // 'my-app'
 * toSlug('ACME Corp')        // 'acme-corp'
 * toSlug('My@App!')          // 'myapp'
 * toSlug('Hello  World')     // 'hello-world'
 * ```
 */
export function toSlug(input: string): string {
    if (!input || typeof input !== 'string') {
        return '';
    }

    return input
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')           // Replace spaces with hyphens
        .replace(/[^a-z0-9_-]/g, '')    // Remove invalid characters
        .replace(/-+/g, '-')            // Replace multiple hyphens with single
        .replace(/^-|-$/g, '');         // Remove leading/trailing hyphens
}

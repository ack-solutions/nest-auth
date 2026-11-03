/**
 * What a session's `refreshToken` column holds for rotation.
 *
 * Normally just the hex HMAC of the current refresh token. With
 * `session.refreshTokenReuse.graceSeconds` on, a rotation also records the
 * token it replaced and when, as `<current>.<previous>.<rotatedAtMs>`, so a
 * client whose refresh reply was lost can retry once with the old token. It is
 * one string in the existing column on purpose: no migration, and custom
 * session stores keep treating it as opaque.
 */
export interface StoredRefreshHash {
    /** HMAC of the refresh token issued last. */
    current: string;
    /** HMAC of the token `current` replaced, while its grace is claimable. */
    previous?: string;
    /** Epoch ms of the rotation that replaced `previous`. */
    rotatedAt?: number;
}

const SEPARATOR = '.';

export function parseStoredRefreshHash(value: string | null | undefined): StoredRefreshHash | null {
    if (!value) return null;
    const [current, previous, rotatedAt] = value.split(SEPARATOR);
    if (!current) return null;
    const at = Number(rotatedAt);
    return previous && Number.isFinite(at)
        ? { current, previous, rotatedAt: at }
        : { current };
}

export function formatStoredRefreshHash(hash: StoredRefreshHash): string {
    return hash.previous && hash.rotatedAt !== undefined
        ? [hash.current, hash.previous, String(hash.rotatedAt)].join(SEPARATOR)
        : hash.current;
}

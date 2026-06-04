/**
 * Shared JWT fixtures for tests.
 *
 * NO MOCKS. These helpers hand-craft real base64url-encoded JWTs. The decoder
 * (`jwt-decode`) does not verify signatures — that's by design — so we don't
 * need a real signing key for unit tests of the client SDK.
 *
 * Signature verification is the BACKEND's responsibility and is tested with
 * a real `jsonwebtoken`-signed token + a real backend in integration tests.
 */

/** Base64-url encode a JSON value. Strips padding, replaces +/. */
function b64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Build a JWT with the given payload + optional header. Signature segment is
 * a fixed placeholder — the client SDK doesn't verify, the test won't notice.
 */
export function makeJwt(
  payload: Record<string, unknown>,
  header: Record<string, unknown> = { alg: 'HS256', typ: 'JWT' },
): string {
  return `${b64url(header)}.${b64url(payload)}.dGVzdC1zaWduYXR1cmU`;
}

/** Current epoch seconds, computed at call time (not import time — avoid flake). */
export const now = (): number => Math.floor(Date.now() / 1000);

/** Build a JWT that expires `seconds` from now. Negative = already expired. */
export function makeJwtExpiringIn(seconds: number, extraClaims: Record<string, unknown> = {}): string {
  return makeJwt({ exp: now() + seconds, ...extraClaims });
}

/** Convenience: a valid JWT (1 hour). */
export function makeValidJwt(extraClaims: Record<string, unknown> = {}): string {
  return makeJwtExpiringIn(3600, { sub: 'test-user', ...extraClaims });
}

/** Convenience: an expired JWT (1 hour past). */
export function makeExpiredJwt(extraClaims: Record<string, unknown> = {}): string {
  return makeJwtExpiringIn(-3600, { sub: 'test-user', ...extraClaims });
}

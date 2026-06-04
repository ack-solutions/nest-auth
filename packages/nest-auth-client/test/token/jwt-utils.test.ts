/**
 * Real tests for token/jwt-utils.ts
 *
 * NO MOCKS. Real jwt-decode, real Buffer, real Date.now().
 *
 * ⚠️  Time-sensitive tests use `now()` from fixtures (computed per-call), NOT
 *    module-level constants. See test-code-review findings P1.
 *    For tests that need to advance the clock, use @sinonjs/fake-timers locally.
 *    Do NOT use `vi.useFakeTimers()` globally — would break refresh-queue tests.
 *
 * Covers: TC-480, TC-481, TC-482, TC-483, TC-484 from .tasks/test-catalog.md §B.5
 */

import { describe, it, expect } from 'vitest';
import {
  decodeJwt,
  isTokenExpired,
  getTokenExpirationDate,
  getTokenTimeToExpiry,
  getUserIdFromToken,
} from '../../src/token/jwt-utils';
import { makeJwt, makeJwtExpiringIn, now } from '../fixtures/jwt.fixtures';

describe('decodeJwt — TC-480/481', () => {
  it('TC-480: parses a valid JWT and returns the payload', () => {
    const payload = { sub: 'user-123', email: 'a@b.test', exp: 9_999_999_999 };
    const decoded = decodeJwt(makeJwt(payload));

    expect(decoded).not.toBeNull();
    expect(decoded?.sub).toBe('user-123');
    expect(decoded?.email).toBe('a@b.test');
    expect(decoded?.exp).toBe(9_999_999_999);
  });

  it('TC-481: returns null on malformed token', () => {
    expect(decodeJwt('not.a.jwt')).toBeNull();
    expect(decodeJwt('completely-invalid')).toBeNull();
    expect(decodeJwt('')).toBeNull();
    expect(decodeJwt(null)).toBeNull();
    expect(decodeJwt(undefined)).toBeNull();
  });

  it('TC-481b: returns null on token with non-JSON payload segment', () => {
    expect(decodeJwt('eyJhbGciOiJIUzI1NiJ9.notjson.sig')).toBeNull();
  });

  it('TC-481c: returns null on 2-segment token (no signature segment)', () => {
    // jwt-decode requires 3 segments
    expect(decodeJwt('header.payload')).toBeNull();
  });
});

describe('isTokenExpired — TC-482', () => {
  // NOTE: each test computes its time delta at execution time via `now()`
  // (from fixtures). Module-level constants would cause CI flake.

  it('returns true when exp is in the past', () => {
    expect(isTokenExpired(makeJwtExpiringIn(-3600))).toBe(true);
  });

  it('returns false when exp is comfortably in the future', () => {
    expect(isTokenExpired(makeJwtExpiringIn(3600))).toBe(false);
  });

  it('threshold treats imminent expiry as expired', () => {
    // 30s from expiry, threshold of 60s → "expired"
    expect(isTokenExpired(makeJwtExpiringIn(30), 60)).toBe(true);
    // Same shape, threshold of 10s → still valid
    expect(isTokenExpired(makeJwtExpiringIn(30), 10)).toBe(false);
  });

  it('TC-482d: exp === now is treated as expired (≤ semantic, not <)', () => {
    // Source uses `exp <= now + threshold` — exactly-equal case
    const token = makeJwt({ exp: now() });
    expect(isTokenExpired(token)).toBe(true);
  });

  it('returns null for null/undefined/missing exp', () => {
    expect(isTokenExpired(null)).toBeNull();
    expect(isTokenExpired(makeJwt({ sub: 'x' }))).toBeNull(); // no exp
  });

  it('accepts already-decoded payload object', () => {
    expect(isTokenExpired({ exp: now() - 3600 } as never)).toBe(true);
    expect(isTokenExpired({ exp: now() + 3600 } as never)).toBe(false);
  });

  it('TC-482c: threshold logic works on decoded payload too', () => {
    // Previously only tested with string tokens — this verifies the second branch
    expect(isTokenExpired({ exp: now() + 30 } as never, 60)).toBe(true);
    expect(isTokenExpired({ exp: now() + 30 } as never, 10)).toBe(false);
  });
});

describe('getTokenExpirationDate — TC-483', () => {
  it('returns a Date matching exp claim', () => {
    const exp = 1_700_000_000;
    const d = getTokenExpirationDate(makeJwt({ exp }));
    expect(d).toBeInstanceOf(Date);
    expect(d?.getTime()).toBe(exp * 1000);
  });

  it('returns null when exp missing or token invalid', () => {
    expect(getTokenExpirationDate(null)).toBeNull();
    expect(getTokenExpirationDate(makeJwt({}))).toBeNull();
    expect(getTokenExpirationDate('garbage')).toBeNull();
  });
});

describe('getTokenTimeToExpiry', () => {
  it('returns positive seconds when token is valid', () => {
    const ttl = getTokenTimeToExpiry(makeJwtExpiringIn(3600));
    // Allow 1s skew window
    expect(ttl).toBeGreaterThan(3598);
    expect(ttl).toBeLessThanOrEqual(3600);
  });

  it('returns negative seconds when token expired', () => {
    expect(getTokenTimeToExpiry(makeJwtExpiringIn(-3600))).toBeLessThan(0);
  });

  it('returns null when exp absent', () => {
    expect(getTokenTimeToExpiry(makeJwt({}))).toBeNull();
  });
});

describe('getUserIdFromToken — TC-484', () => {
  it('extracts userId from `sub` claim', () => {
    expect(getUserIdFromToken(makeJwt({ sub: 'user-1' }))).toBe('user-1');
  });

  it('prefers `userId` claim over `sub`', () => {
    // The implementation order is: userId → sub → user_id
    expect(getUserIdFromToken(makeJwt({ userId: 'u-X', sub: 'u-Y' }))).toBe('u-X');
  });

  it('falls back to `user_id` (snake_case)', () => {
    expect(getUserIdFromToken(makeJwt({ user_id: 'snake-case' }))).toBe('snake-case');
  });

  it('returns null if no recognized claim', () => {
    expect(getUserIdFromToken(makeJwt({ email: 'no-id@x' }))).toBeNull();
  });

  it('returns null for null/empty input', () => {
    expect(getUserIdFromToken(null)).toBeNull();
    expect(getUserIdFromToken(undefined)).toBeNull();
    expect(getUserIdFromToken('')).toBeNull();
  });

  it('TC-484c: accepts already-decoded payload object', () => {
    // Previously only tested with string tokens — this hits the polymorphism branch
    expect(getUserIdFromToken({ sub: 'decoded-sub' } as never)).toBe('decoded-sub');
    expect(getUserIdFromToken({ userId: 'decoded-userId' } as never)).toBe('decoded-userId');
  });
});

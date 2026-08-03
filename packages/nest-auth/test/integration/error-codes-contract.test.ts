/**
 * Drift guard: every error `code` the server can emit (nest-auth's ERROR_CODES)
 * must be present in the browser-safe `NestAuthErrorCode` enum exported from
 * @ackplus/nest-auth-contracts — so a portal can match codes with a typed enum
 * instead of bare string literals, and can never miss one the server sends.
 */
import { describe, it, expect } from 'vitest';
import { ERROR_CODES } from '../../src/lib/auth.constants';
// Import the contracts SOURCE so the guard doesn't depend on a rebuilt dist.
import { NestAuthErrorCode } from '../../../nest-auth-contracts/src/error-codes';

describe('error-code contract (nest-auth ↔ nest-auth-contracts)', () => {
  it('every server ERROR_CODES value is present in NestAuthErrorCode', () => {
    const contractCodes = new Set<string>(Object.values(NestAuthErrorCode));
    const missing = Object.values(ERROR_CODES).filter((code) => !contractCodes.has(code as string));
    expect(missing).toEqual([]);
  });

  it('the enum is a plain string map (browser-safe, no server imports)', () => {
    for (const [k, v] of Object.entries(NestAuthErrorCode)) {
      expect(v).toBe(k); // KEY === 'KEY' convention
    }
  });
});

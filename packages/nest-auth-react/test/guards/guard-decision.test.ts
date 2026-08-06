/**
 * Guards must fire their redirect / access-denied callbacks ONLY on a DEFINITIVE
 * state. The `'unknown'` status (a session check that couldn't complete — server
 * outage) must NEVER trigger a redirect, a guest-page flash, or an access denial:
 * it renders the neutral loading state instead. This is the regression that the
 * original 2.9.0 diff missed — adding `'unknown'` without teaching the guards
 * about it made them treat an outage as logged-out.
 *
 * NO MOCKS — pure decision functions over real status values.
 */
import { describe, it, expect } from 'vitest';
import type { AuthStatus } from '@ackplus/nest-auth-client';
import { decideAuthGuard, decideGuestGuard, decideAccessGuard } from '../../src/guards/guard-decision';

const S = (status: AuthStatus, isLoading = false) => ({ status, isLoading });

describe('AuthGuard decision', () => {
    it('UNKNOWN never redirects — renders loading (the outage guard)', () => {
        expect(decideAuthGuard(S('unknown'))).toEqual({ outcome: 'loading', fireCallback: false });
    });
    it('loading renders loading, no redirect', () => {
        expect(decideAuthGuard(S('loading', true))).toEqual({ outcome: 'loading', fireCallback: false });
    });
    it('authenticated renders children', () => {
        expect(decideAuthGuard(S('authenticated'))).toEqual({ outcome: 'children', fireCallback: false });
    });
    it('unauthenticated (definitive) fires the redirect', () => {
        expect(decideAuthGuard(S('unauthenticated'))).toEqual({ outcome: 'deny', fireCallback: true });
    });
});

describe('GuestGuard decision', () => {
    it('UNKNOWN does NOT flash the login page — renders loading', () => {
        expect(decideGuestGuard(S('unknown'))).toEqual({ outcome: 'loading', fireCallback: false });
    });
    it('guest (unauthenticated) renders children', () => {
        expect(decideGuestGuard(S('unauthenticated'))).toEqual({ outcome: 'children', fireCallback: false });
    });
    it('authenticated (definitive) fires the redirect away', () => {
        expect(decideGuestGuard(S('authenticated'))).toEqual({ outcome: 'deny', fireCallback: true });
    });
    it('add-account mode renders children regardless of status (even unknown)', () => {
        expect(decideGuestGuard(S('unknown'), true)).toEqual({ outcome: 'children', fireCallback: false });
        expect(decideGuestGuard(S('authenticated'), true)).toEqual({ outcome: 'children', fireCallback: false });
    });
});

describe('RequireRole / RequirePermission decision', () => {
    it('UNKNOWN never denies access — renders loading', () => {
        expect(decideAccessGuard(S('unknown'), false)).toEqual({ outcome: 'loading', fireCallback: false });
        expect(decideAccessGuard(S('unknown'), true)).toEqual({ outcome: 'loading', fireCallback: false });
    });
    it('authenticated + has access renders children', () => {
        expect(decideAccessGuard(S('authenticated'), true)).toEqual({ outcome: 'children', fireCallback: false });
    });
    it('authenticated but missing access denies (definitive)', () => {
        expect(decideAccessGuard(S('authenticated'), false)).toEqual({ outcome: 'deny', fireCallback: true });
    });
    it('unauthenticated denies (definitive)', () => {
        expect(decideAccessGuard(S('unauthenticated'), false)).toEqual({ outcome: 'deny', fireCallback: true });
    });
    it('loading renders loading, never denies', () => {
        expect(decideAccessGuard(S('loading', true), false)).toEqual({ outcome: 'loading', fireCallback: false });
    });
});

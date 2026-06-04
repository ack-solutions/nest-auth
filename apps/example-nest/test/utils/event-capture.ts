/**
 * Event-capture test helper — NO MOCKS.
 *
 * Attaches a real `onAny` listener to the production `EventEmitter2` and records
 * every emitted event. The auth flows store only the *hash* of an OTP / reset /
 * verification code, but they emit the plaintext `code` on a `*.requested` /
 * `*.code_sent` event (so a real consumer can render it into an email/SMS). Tests
 * read the code straight off the event instead of standing up a real SMTP/SMS
 * server — the code never leaves the process.
 *
 * Mirrors the package's own `test/helpers/event-capture.ts`, adapted to take the
 * `EventEmitter2` directly.
 */

import type { EventEmitter2 } from '@nestjs/event-emitter';

export interface CapturedEvent {
    name: string;
    payload: any;
    at: number;
}

export interface EventCapture {
    /** All events captured so far, in order. */
    all(): CapturedEvent[];
    /** Events whose name contains the given substring (case-insensitive). */
    matching(substr: string): CapturedEvent[];
    /** Most recent event whose name contains the substring, or undefined. */
    last(substr: string): CapturedEvent | undefined;
    /** Plaintext `code` from the most recent event whose name matches `substr`. */
    codeFrom(substr: string): string | undefined;
    lastEmailVerificationCode(): string | undefined;
    lastPhoneVerificationCode(): string | undefined;
    lastPasswordResetCode(): string | undefined;
    lastPasswordlessCode(): string | undefined;
    /** Plaintext OTP sent for an Email/SMS MFA challenge (`two_factor_code_sent`). */
    lastTwoFactorCode(): string | undefined;
    /** Reset the captured list (call in `beforeEach` if you reuse one app). */
    clear(): void;
}

export function attachEventCapture(bus: EventEmitter2): EventCapture {
    const captured: CapturedEvent[] = [];

    bus.onAny((name: any, payload: unknown) => {
        captured.push({ name: String(name), payload, at: Date.now() });
    });

    const codeFrom = (substr: string): string | undefined => {
        const ev = [...captured]
            .reverse()
            .find((e) => e.name.toLowerCase().includes(substr.toLowerCase()));
        if (!ev) return undefined;
        // Events carry `payload.code` (plaintext); some emissions wrap the payload
        // in an event-class instance with a `.payload` property — handle both.
        return ev.payload?.code ?? ev.payload?.payload?.code;
    };

    return {
        all: () => [...captured],
        matching: (substr) =>
            captured.filter((e) => e.name.toLowerCase().includes(substr.toLowerCase())),
        last: (substr) =>
            [...captured].reverse().find((e) => e.name.toLowerCase().includes(substr.toLowerCase())),
        codeFrom,
        lastEmailVerificationCode: () => codeFrom('email.verification'),
        lastPhoneVerificationCode: () => codeFrom('phone.verification'),
        lastPasswordResetCode: () => codeFrom('password_reset') ?? codeFrom('password.reset'),
        lastPasswordlessCode: () => codeFrom('passwordless'),
        lastTwoFactorCode: () => codeFrom('two_factor_code_sent') ?? codeFrom('two_factor'),
        clear: () => {
            captured.length = 0;
        },
    };
}

/**
 * Event-capture test helper.
 *
 * NO MOCKS. Attaches a real `onAny` listener to the production `EventEmitter2`
 * and records every emitted event. Tests use it to extract the plaintext OTP /
 * verification codes that the auth flows emit (the entity stores only the hash,
 * but the *.requested events carry the plaintext `code` for email/SMS templates).
 *
 * This replaces the need for a real SMTP/SMS server in tests — the code never
 * leaves the process, we just read it off the event.
 */

import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { TestAppHandle } from './boot-test-app';

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
  /** Plaintext code from the most recent email-verification-requested event. */
  lastEmailVerificationCode(): string | undefined;
  /** Plaintext code from the most recent phone-verification-requested event. */
  lastPhoneVerificationCode(): string | undefined;
  /** Plaintext code from the most recent password-reset-requested event. */
  lastPasswordResetCode(): string | undefined;
  /** Plaintext code from the most recent passwordless-code-requested event. */
  lastPasswordlessCode(): string | undefined;
  /** Reset the captured list. */
  clear(): void;
}

/**
 * Attach an event capture to a booted test app.
 *
 * @example
 * ```ts
 * const handle = await bootTestApp();
 * const events = attachEventCapture(handle);
 * // ... trigger a flow ...
 * const code = events.lastPasswordResetCode();
 * ```
 */
export function attachEventCapture(handle: TestAppHandle): EventCapture {
  const bus = handle.get<EventEmitter2>(
    // EventEmitter2 is registered under its class token by EventEmitterModule
    require('@nestjs/event-emitter').EventEmitter2,
  );

  const captured: CapturedEvent[] = [];

  bus.onAny((name: any, payload: unknown) => {
    captured.push({ name: String(name), payload, at: Date.now() });
  });

  const codeFrom = (substr: string): string | undefined => {
    const ev = [...captured].reverse().find((e) => e.name.toLowerCase().includes(substr.toLowerCase()));
    if (!ev) return undefined;
    // Events carry `payload.code` (plaintext) per the *.requested event classes.
    // Some bus emissions wrap the payload in an event-class instance with a
    // `.payload` property — handle both shapes.
    return ev.payload?.code ?? ev.payload?.payload?.code;
  };

  return {
    all: () => [...captured],
    matching: (substr) => captured.filter((e) => e.name.toLowerCase().includes(substr.toLowerCase())),
    last: (substr) => [...captured].reverse().find((e) => e.name.toLowerCase().includes(substr.toLowerCase())),
    lastEmailVerificationCode: () => codeFrom('email.verification'),
    lastPhoneVerificationCode: () => codeFrom('phone.verification'),
    lastPasswordResetCode: () => codeFrom('password_reset') ?? codeFrom('password.reset'),
    lastPasswordlessCode: () => codeFrom('passwordless'),
    clear: () => {
      captured.length = 0;
    },
  };
}

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NestAuthEvents } from '@ackplus/nest-auth';

/**
 * DEV-ONLY: prints the OTP / verification / reset / passwordless codes to the
 * console.
 *
 * Locally there is no real email/SMS provider wired up, so codes would otherwise
 * go nowhere — you'd be unable to finish "forgot password", passwordless login,
 * email/phone verification, or email/SMS MFA in the browser. This listener echoes
 * the plaintext code (which the auth flows already emit on these events for the
 * email/SMS template) so you can copy it from the `pnpm demo` / docker logs.
 *
 * Disabled automatically in production (`NODE_ENV=production`). NEVER ship this in
 * a real deployment — codes must not be logged.
 */
@Injectable()
export class DevCodeLogger {
    private readonly logger = new Logger('DemoCodes');
    private readonly enabled = process.env.NODE_ENV !== 'production';

    private echo(kind: string, payload: any): void {
        if (!this.enabled) return;
        const code = payload?.code ?? payload?.payload?.code;
        if (!code) return;
        const p = payload?.payload ?? payload;
        const who =
            p?.email ?? p?.identifier ?? p?.phone ?? p?.user?.email ?? p?.user?.phone ?? 'user';
        this.logger.warn(`>>> ${kind} code for ${who}: ${code}  (dev only — no email/SMS provider)`);
    }

    @OnEvent(NestAuthEvents.EMAIL_VERIFICATION_REQUESTED)
    onEmailVerification(payload: any) {
        this.echo('EMAIL_VERIFICATION', payload);
    }

    @OnEvent(NestAuthEvents.PHONE_VERIFICATION_REQUESTED)
    onPhoneVerification(payload: any) {
        this.echo('PHONE_VERIFICATION', payload);
    }

    @OnEvent(NestAuthEvents.PASSWORD_RESET_REQUESTED)
    onPasswordReset(payload: any) {
        this.echo('PASSWORD_RESET', payload);
    }

    @OnEvent(NestAuthEvents.PASSWORDLESS_CODE_REQUESTED)
    onPasswordless(payload: any) {
        this.echo('PASSWORDLESS', payload);
    }

    @OnEvent(NestAuthEvents.TWO_FACTOR_CODE_SENT)
    onTwoFactor(payload: any) {
        this.echo('MFA_OTP', payload);
    }
}

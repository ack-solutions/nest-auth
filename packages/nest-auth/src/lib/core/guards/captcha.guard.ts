import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthConfigService } from '../services/auth-config.service';
import { CAPTCHA_KEY, ERROR_CODES } from '../../auth.constants';

/**
 * Verifies a CAPTCHA token on routes marked `@Captcha()`. A no-op unless
 * `security.captcha.enabled` AND a `verify` function is configured (the library
 * is provider-agnostic — you call Turnstile / hCaptcha / reCAPTCHA). The token
 * arrives in the `x-captcha-token` header or a `captchaToken` body field.
 */
@Injectable()
export class CaptchaGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const marked = this.reflector.getAllAndOverride<boolean>(CAPTCHA_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!marked) return true;

        const cfg = AuthConfigService.getOptions().security?.captcha;
        if (!cfg?.enabled || typeof cfg.verify !== 'function') return true; // not configured → skip

        const http = context.switchToHttp();
        const req: any = http.getRequest();
        const headerName = (cfg.headerName || 'x-captcha-token').toLowerCase();
        const bodyField = cfg.bodyField || 'captchaToken';

        const raw = req.headers?.[headerName] ?? req.body?.[bodyField];
        const token = Array.isArray(raw) ? raw[0] : raw;
        if (!token || typeof token !== 'string') {
            throw new BadRequestException({ message: 'CAPTCHA token is required', code: ERROR_CODES.CAPTCHA_REQUIRED });
        }

        let ok = false;
        try {
            ok = await cfg.verify(token, { ip: req?.ip, route: req?.path });
        } catch {
            ok = false; // a verifier that throws is treated as a failed check
        }
        if (!ok) {
            throw new BadRequestException({ message: 'CAPTCHA verification failed', code: ERROR_CODES.CAPTCHA_FAILED });
        }
        return true;
    }
}

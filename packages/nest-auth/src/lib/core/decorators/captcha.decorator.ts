import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { CaptchaGuard } from '../guards/captcha.guard';
import { CAPTCHA_KEY } from '../../auth.constants';

/**
 * `@Captcha()` — require a verified CAPTCHA token on a route (signup,
 * forgot-password). A no-op unless `security.captcha.enabled` and a `verify`
 * function are configured.
 */
export function Captcha() {
    return applyDecorators(SetMetadata(CAPTCHA_KEY, true), UseGuards(CaptchaGuard));
}

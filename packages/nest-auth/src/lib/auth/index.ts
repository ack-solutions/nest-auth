// Guards
export * from './guards/auth.guard';
export { OPTIONAL_AUTH_KEY } from './guards/auth.guard';

// Interceptors
export * from './interceptors/token-response.interceptor';

// Events
export * from './events/logged-out-all.event';
export * from './events/logged-out.event';
export * from './events/password-reset-requested.event';
export * from './events/password-reset.event';
export * from './events/user-2fa-verified.event';
export * from './events/user-logged-in.event';
export * from './events/user-refresh-token.event';
export * from './events/user-registered.event';
export * from './events/two-factor-code-sent.event';

// Services
export * from './services/auth.service';
export * from './services/mfa.service';
export * from './services/client-config.service';

// Controllers
export * from './controllers/auth.controller';
export * from './controllers/mfa.controller';

// DTOs
export * from './dto/requests/login.request.dto';
export * from './dto/requests/signup.request.dto';
export * from './dto/credentials/social-credentials.dto';
export * from './dto/credentials/email-credentials.dto';
export * from './dto/credentials/phone-credentials.dto';
export * from './dto/requests/forgot-password.request.dto';
export * from './dto/requests/reset-password.request.dto';
export * from './dto/requests/reset-password-with-token.request.dto';
export * from './dto/requests/verify-forgot-password-otp-request-dto';
export * from './dto/requests/send-mfa-code.request.dto';
export * from './dto/requests/change-password.request.dto';
export * from './dto/requests/toggle-mfa.request.dto';
export * from './dto/requests/refresh-token.request.dto';
export * from './dto/requests/verify-2fa.request.dto';
export * from './dto/requests/verify-totp-setup.request.dto';
export * from './dto/responses/auth.response.dto';
export * from './dto/responses/auth-cookie.response.dto';
export * from './dto/responses/verify-otp.response.dto';
export * from './dto/responses/mfa-status.response.dto';
export * from './dto/responses/client-config.response.dto';

// Entities
export * from './entities/otp.entity';
export * from './entities/mfa-secret.entity';
export * from './entities/trusted-device.entity';

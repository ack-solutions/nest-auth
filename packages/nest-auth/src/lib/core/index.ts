
// Decorators
export * from './decorators/role.decorator';
export * from './decorators/permissions.decorator';
export * from './decorators/skip-mfa.decorator';
export * from './decorators/auth.decorator';
export * from './decorators/public.decorator';
export * from './decorators/current-user.decorator';
export * from './decorators/must-change-password.decorator';
export * from './decorators/skip-email-verification.decorator';
// Security decorators — reuse on your OWN routes (no-ops unless the matching
// security.* block is enabled).
export * from './decorators/rate-limit.decorator';
export * from './decorators/captcha.decorator';
export * from './decorators/lockout.decorator';

// Security guards — for `@UseGuards(...)` on your own routes.
export * from './guards/rate-limit.guard';
export * from './guards/lockout.guard';
export * from './guards/captcha.guard';

// Swagger / OpenAPI helpers
export * from './swagger/api-responses.decorator';

// Interfaces
export * from './interfaces/auth-module-options.interface';
export * from './interfaces/mfa-options.interface';
export * from './interfaces/session-options.interface';
export * from './interfaces/token-payload.interface';
export * from './interfaces/rate-limit.interface';

// Entities
export * from './entities';

// DTOs
export * from './dto/message.response.dto';

// Providers
export * from './providers/base-auth.provider';
export * from './providers/email-auth.provider';
export * from './providers/phone-auth.provider';
export * from './providers/jwt-auth.provider';
export * from './providers/google-auth.provider';
export * from './providers/facebook-auth.provider';
export * from './providers/apple-auth.provider';
export * from './providers/github-auth.provider';
export * from './providers/passwordless-auth.provider';

// Services
export * from './services/auth-provider-registry.service';
export * from './services/jwt.service';

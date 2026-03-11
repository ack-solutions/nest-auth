import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Parameter decorator to get the current tenant id from the request.
 * Set by the auth guard from session.data.tenantId or JWT payload.
 * Returns null when tenant support is disabled or no tenant in context.
 *
 * Use only after auth (e.g. with NestAuthAuthGuard). Safe when tenant is disabled (returns null).
 */
export const CurrentTenantId = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): string | null => {
        const request = ctx.switchToHttp().getRequest();
        return request.tenantId ?? null;
    }
);

/**
 * Alias for CurrentTenantId for backward compatibility.
 * @deprecated Use CurrentTenantId
 */
export const CurrentTenant = CurrentTenantId;

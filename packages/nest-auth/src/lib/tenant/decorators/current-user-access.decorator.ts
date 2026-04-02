import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { NestAuthUserAccess } from '../../user/entities/user-access.entity';

/**
 * Parameter decorator to get the current user's access for the active tenant (includes roles).
 * The auth guard sets request.userAccess when tenant is enabled and user is authenticated.
 * Returns null when tenant is disabled, or user has no access for the current tenant.
 *
 * Use only after auth (e.g. with NestAuthAuthGuard). Safe when tenant is disabled (returns null).
 */
export const CurrentUserAccess = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): NestAuthUserAccess | null => {
        const request = ctx.switchToHttp().getRequest();
        return request.userAccess ?? null;
    }
);

/** @deprecated Use CurrentUserAccess */
export const CurrentMembership = CurrentUserAccess;

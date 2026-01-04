import { SetMetadata, applyDecorators } from '@nestjs/common';

export const ROLES_KEY = 'nest_auth_roles';
export const GUARD_KEY = 'nest_auth_guard';

/**
 * Decorator to specify required roles for a route
 * @param roles - Array of role strings or single role string
 * @param guard - Optional guard name to filter roles
 * @returns Decorator function
 */
export const NestAuthRoles = (roles: string[] | string, guard?: string) => {
    if (guard) {
        return applyDecorators(
            SetMetadata(ROLES_KEY, roles),
            SetMetadata(GUARD_KEY, guard)
        );
    }
    return SetMetadata(ROLES_KEY, roles);
};


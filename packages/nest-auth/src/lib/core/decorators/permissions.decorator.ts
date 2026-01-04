import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'nest_auth_permissions';

/**
 * Decorator to specify required permissions for a route or controller.
 *
 * Works on both methods and classes and is compatible with NestJS `Reflector`.
 *
 * @param permissions - Array of permission strings or single permission string
 */
export const NestAuthPermissions = (permissions: string[] | string) =>
    SetMetadata(PERMISSIONS_KEY, permissions);

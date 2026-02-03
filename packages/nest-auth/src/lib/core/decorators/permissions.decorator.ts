import { SetMetadata, applyDecorators } from '@nestjs/common';

export const PERMISSIONS_KEY = 'nest_auth_permissions';
export const PERMISSIONS_REQUIRE_ALL_KEY = 'nest_auth_permissions_require_all';

/**
 * Options for permission check behavior.
 * - true (default): user must have ALL listed permissions
 * - false: user must have AT LEAST ONE of the listed permissions
 */
export type PermissionsRequireAll = boolean;

/**
 * Decorator to specify required permissions for a route or controller.
 *
 * Works on both methods and classes and is compatible with NestJS `Reflector`.
 *
 * @param permissions - Array of permission strings or single permission string
 * @param requireAll - If true, user must have ALL permissions. If false (default), user needs ANY ONE permission.
 *
 * @example
 * // Require both 'read' and 'write'
 * @NestAuthPermissions(['read', 'write'], true)
 *
 * @example
 * // Require at least one of 'read' or 'write' (default)
 * @NestAuthPermissions(['read', 'write'])
 *
 * @example
 * // Single permission
 * @NestAuthPermissions('admin')
 */
export const NestAuthPermissions = (
    permissions: string[] | string,
    requireAll: PermissionsRequireAll = false,
) =>
    applyDecorators(
        SetMetadata(PERMISSIONS_KEY, permissions),
        SetMetadata(PERMISSIONS_REQUIRE_ALL_KEY, requireAll),
    );

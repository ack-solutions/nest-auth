import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'nest_auth_permissions';

/**
 * Decorator to specify required permissions for a route
 * @param permissions - Array of permission strings or single permission string
 * @returns Decorator function
 */
export function NestAuthPermissions(permissions: string[] | string) {
    return (target: any, key?: string, descriptor?: PropertyDescriptor) => {
        if (descriptor) {
            Reflect.defineMetadata(PERMISSIONS_KEY, permissions, descriptor.value);
        }
        return descriptor;
    };
}

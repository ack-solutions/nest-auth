
export const ROLES_KEY = 'nest_auth_roles';
export const GUARD_KEY = 'nest_auth_guard';


export function NestAuthRoles(roles: string[] | string, guard?: string) {
    return (target: any, key: string, descriptor: PropertyDescriptor) => {
        Reflect.defineMetadata(ROLES_KEY, roles, descriptor.value);
        Reflect.defineMetadata(GUARD_KEY, guard, descriptor.value);
        return descriptor;
    };
}

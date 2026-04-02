import { chain } from 'lodash';
import { IsNull } from 'typeorm';
import { NestAuthPlatformAccess } from '../../user/entities/platform-access.entity';
import { NestAuthUserAccess } from '../../user/entities/user-access.entity';
import { getRolePermissionNames } from './role-mapper.util';
import { NestAuthRole } from '../entities/role.entity';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { RequestContext } from '../../request-context';

type ResolveRolesParams = {
    userId: string;
    tenantId: string | null;

};

export class AccessRoleResolver {
    /**
     * Central resolver for session/auth role + permission snapshots.
     * Ensures platform-admin roles are included consistently (login + refresh + session creation).
     */
    static async resolveRolesAndPermissionsForTenantContext(
        params: ResolveRolesParams,
    ): Promise<{ roles: any[]; permissions: string[] }> {
        const { userId, tenantId } = params;

        const platformAccess = await NestAuthUserAccess.findOne({
            where: {
                userId,
                tenantId: tenantId == null ? IsNull() : tenantId,
            } as any,
            relations: ['roles', 'roles.rolePermissions', 'roles.rolePermissions.permission'],
        })

        const mergedRoles = platformAccess?.roles ?? [];

        // de-dupe roles by id
        const uniqRoleMap = new Map(mergedRoles.map((r: any) => [r.id, r]));
        const roles = Array.from(uniqRoleMap.values());

        const permissions = chain(roles)
            .map((role: any) => getRolePermissionNames(role))
            .flatten()
            .uniq()
            .value();

        return { roles, permissions };
    }

    static async isPlatformAccess(): Promise<boolean> {
        const authConfig = AuthConfigService.getOptions();
        if (authConfig.platformAccess?.enabled === true){
            return await authConfig.platformAccess.validate(RequestContext.currentRequest());
        }else{
            return false;
        }
    }

    static async resolvePlatformAccess(userId: string): Promise<NestAuthRole[]> {
        const platformAccess = await NestAuthPlatformAccess.findOne({
            where: { userId, isActive: true },
            relations: ['roles'],
        });

        return platformAccess?.roles ?? [];
    }

    static async resolvePlatformAccessRolesAndPermissions(userId: string): Promise<{ roles: NestAuthRole[]; permissions: string[] }> {
        const tenantAccess = await this.resolvePlatformAccess(userId);

        const roles: NestAuthRole[] = tenantAccess ?? [];
        const permissions = chain(roles)
            .map((role: any) => getRolePermissionNames(role))
            .flatten()
            .uniq()
            .value();

        return { roles, permissions };  

    }

    static async isPlatformAdminUser(userId: string): Promise<boolean> {
        const platformAccessRoles = await this.resolvePlatformAccess(userId);

        return (platformAccessRoles?.length ?? 0) > 0;
    }
}

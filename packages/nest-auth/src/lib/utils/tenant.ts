import { TenantModeEnum } from "@ackplus/nest-auth-contracts";
import { BadRequestException } from "@nestjs/common";
import { ERROR_CODES } from "../auth.constants";
import { IAuthModuleOptions } from "../core";

export function requiredTenant(tenantConfig: IAuthModuleOptions['tenant'], tenantId: string | null, throwError: boolean = true, platform: boolean = false): boolean {
    // Platform (super-admin) context is tenant-less by definition: it is never
    // scoped to a tenant and never requires one — even under ISOLATED. This is
    // the explicit, request-independent opt-in used to provision/look up
    // platform users (e.g. at boot, where there is no request to validate).
    if (platform) {
        return false;
    }
    const tenantEnabled = tenantConfig?.enabled;
    const tenantMode = tenantConfig?.mode;
    if (throwError && tenantEnabled && tenantMode === TenantModeEnum.ISOLATED && !tenantId) {
        throw new BadRequestException({
            message: 'Tenant ID is required',
            code: ERROR_CODES.TENANT_ID_REQUIRED,
        });
    }
    if (tenantEnabled && tenantMode === TenantModeEnum.ISOLATED) {
        return true
    }
    return false
}
import { DynamicModule, Module } from '@nestjs/common';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminSeeder } from './platform-admin.seeder';
import { PlatformMfaGuard } from './platform-mfa.guard';
import { platformOptions } from './platform.constants';

/**
 * Platform-admin portal: cross-tenant management gated by a platform-level role
 * (+ an optional MFA-required policy). Relies on the global NestAuthModule for
 * UserService / RoleService / TenantService.
 *
 * Configurable via env (see platform.constants.ts):
 *   - PLATFORM_ADMIN_ENABLED=false  → don't mount the portal at all
 *   - PLATFORM_ADMIN_SEED=false     → don't auto-create the first admin
 *   - PLATFORM_REQUIRE_MFA=true     → platform admins must have MFA enabled
 */
@Module({})
export class PlatformModule {
    static register(): DynamicModule {
        const opts = platformOptions();
        if (!opts.enabled) {
            return { module: PlatformModule };
        }
        return {
            module: PlatformModule,
            controllers: [PlatformAdminController],
            providers: [PlatformMfaGuard, ...(opts.seed ? [PlatformAdminSeeder] : [])],
        };
    }
}

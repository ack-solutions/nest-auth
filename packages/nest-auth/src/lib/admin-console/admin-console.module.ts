import { MiddlewareConsumer, Module, NestModule, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NestAuthAdminUser } from './entities/admin-user.entity';
import { AdminUserService } from './services/admin-user.service';
import { AdminAuthService } from './services/admin-auth.service';
import { AdminSessionService } from './services/admin-session.service';
import { AdminConsoleController } from './controllers/admin-console.controller';
import { AdminAuthController } from './controllers/admin-auth.controller';
import { AdminSessionGuard } from './guards/admin-session.guard';
import { AdminBruteForceGuard } from './guards/admin-brute-force.guard';
import { UserModule } from '../user/user.module';
import { RoleModule } from '../role/role.module';
import { TenantModule } from '../tenant/tenant.module';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminRolesController } from './controllers/admin-roles.controller';
import { AdminTenantsController } from './controllers/admin-tenants.controller';
import { AdminPermissionsController } from './controllers/admin-permissions.controller';
import { AdminBlockedDomainsController } from './controllers/admin-blocked-domains.controller';
import { AdminConsoleConfigService } from './services/admin-console-config.service';
import { AdminSecurityHeadersMiddleware } from './middleware/admin-security-headers.middleware';
import { AuthModule } from '../auth/auth.module';
import { NestAuthMFASecret } from '../auth/entities/mfa-secret.entity';
import { NestAuthTrustedDevice } from '../auth/entities/trusted-device.entity';
import { NestAuthUser } from '../user/entities/user.entity';
import { PermissionModule } from '../permission/permission.module';
import { SessionModule } from '../session/session.module';
import { NestAuthUserAccess } from '../user/entities/user-access.entity';
import { NestAuthPlatformAccess } from '../user/entities/platform-access.entity';
import { AdminUserManagementService } from './services/admin-user-management.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NestAuthAdminUser,
      NestAuthMFASecret,
      NestAuthTrustedDevice,
      NestAuthUser,
      NestAuthUserAccess,
      NestAuthPlatformAccess,
    ]),
    forwardRef(() => AuthModule),
    forwardRef(() => UserModule),
    forwardRef(() => RoleModule),
    forwardRef(() => TenantModule),
    forwardRef(() => SessionModule),
    PermissionModule,
  ],
  providers: [
    AdminUserService,
    AdminAuthService,
    AdminSessionService,
    AdminConsoleConfigService,
    AdminUserManagementService,
    AdminSessionGuard,
    AdminBruteForceGuard,
  ],
  controllers: [
    // Register API controllers FIRST so they match before the UI catch-all route
    AdminAuthController,
    AdminUsersController,
    AdminRolesController,
    AdminTenantsController,
    AdminPermissionsController,
    AdminBlockedDomainsController,
    // UI controller LAST - it has catch-all routes that should only match non-API paths
    AdminConsoleController,
  ],
  exports: [
    AdminUserService,
    AdminAuthService,
    AdminSessionService,
    AdminConsoleConfigService,
    AdminSessionGuard,
    TypeOrmModule,
  ],
})
export class AdminConsoleModule implements NestModule {
  // Apply defense-in-depth security headers (clickjacking, MIME-sniffing,
  // referrer) to every admin-console route — the SPA shell and all admin API
  // controllers. Bound to the controllers rather than a path so it tracks a
  // custom adminConsole.path automatically.
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(AdminSecurityHeadersMiddleware)
      .forRoutes(
        AdminConsoleController,
        AdminAuthController,
        AdminUsersController,
        AdminRolesController,
        AdminTenantsController,
        AdminPermissionsController,
        AdminBlockedDomainsController,
      );
  }
}

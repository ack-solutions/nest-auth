import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RoleService, UserService } from '@ackplus/nest-auth';
import {
    PLATFORM_ADMIN_EMAIL,
    PLATFORM_ADMIN_PASSWORD,
    PLATFORM_GUARD,
    PLATFORM_SUPER_ADMIN_ROLE,
} from './platform.constants';

/**
 * Bootstraps the first platform admin on startup (solves the chicken-and-egg of
 * "who creates the first super admin"). Idempotent — safe to run every boot.
 *
 * Steps:
 *   1. ensure the platform-level `super_admin` role (guard=platform, tenantId=null)
 *   2. ensure the first platform-admin user (a normal NestAuthUser)
 *   3. grant the role via the user's PLATFORM access record (tenantId = null)
 *
 * In production you'd seed this from a migration/secret instead of env defaults.
 */
@Injectable()
export class PlatformAdminSeeder implements OnModuleInit {
    private readonly logger = new Logger('PlatformAdmin');

    constructor(
        private readonly roles: RoleService,
        private readonly users: UserService,
    ) {}

    async onModuleInit(): Promise<void> {
        try {
            // 1. platform role (tenantId = null → applies across every tenant)
            let role = await this.roles
                .getRoleByName(PLATFORM_SUPER_ADMIN_ROLE, PLATFORM_GUARD)
                .catch(() => null);
            if (!role) {
                role = await this.roles.createRole(PLATFORM_SUPER_ADMIN_ROLE, PLATFORM_GUARD, null, false);
                this.logger.log(`Created platform role '${PLATFORM_SUPER_ADMIN_ROLE}' (guard=${PLATFORM_GUARD})`);
            }

            // 2. first platform admin — a FULL nest-auth user (can use social/MFA/etc.)
            let user = await this.users.getUserByEmail(PLATFORM_ADMIN_EMAIL).catch(() => null);
            if (!user) {
                user = await this.users.createUser({ email: PLATFORM_ADMIN_EMAIL });
                await user.setPassword(PLATFORM_ADMIN_PASSWORD);
                await user.save();
                this.logger.log(`Created platform admin user ${PLATFORM_ADMIN_EMAIL}`);
            }

            // 3. grant via the first-class PLATFORM access (NestAuthPlatformAccess) —
            //    cross-tenant + origin-locked by platformAccess.validate (app.module.ts).
            const platformAccess = await user.getPlatformAccess(true);
            await platformAccess.assignRoles([role.id]);
            this.logger.warn(
                `Platform admin ready -> ${PLATFORM_ADMIN_EMAIL} (dev password: ${PLATFORM_ADMIN_PASSWORD})`,
            );
        } catch (e: any) {
            // Don't crash boot if seeding can't run (e.g. ISOLATED mode needs a
            // reserved platform tenant for a tenant-less admin).
            this.logger.warn(
                `Platform admin seed skipped: ${e?.message}. (ISOLATED mode needs a reserved platform tenant.)`,
            );
        }
    }
}

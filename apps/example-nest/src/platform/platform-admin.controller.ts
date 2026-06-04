import {
    BadRequestException,
    Body,
    Controller,
    Get,
    NotFoundException,
    Post,
    UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
    NestAuthAuthGuard,
    NestAuthRoles,
    RequestContext,
    RoleService,
    TenantService,
    UserService,
} from '@ackplus/nest-auth';
import { PLATFORM_GUARD, PLATFORM_SUPER_ADMIN_ROLE } from './platform.constants';
import { PlatformMfaGuard } from './platform-mfa.guard';

/**
 * Platform-admin portal API — manages the ENTIRE platform across all tenants.
 *
 * Every route requires an authenticated user holding the platform-level
 * `super_admin` role under the `platform` guard. Because that role has
 * `tenantId = null`, a tenant user can never reach these routes, and the admin
 * operates above tenant scoping (queries are intentionally NOT tenant-filtered).
 */
@ApiTags('platform-admin')
@Controller('platform')
@UseGuards(NestAuthAuthGuard, PlatformMfaGuard)
@NestAuthRoles(PLATFORM_SUPER_ADMIN_ROLE, PLATFORM_GUARD)
export class PlatformAdminController {
    constructor(
        private readonly users: UserService,
        private readonly tenants: TenantService,
        private readonly roles: RoleService,
    ) {}

    /** Who am I (the platform admin). Proves it's a real NestAuthUser. */
    @Get('me')
    async me() {
        const user = await RequestContext.currentUser();
        return { id: user?.id, email: user?.email, scope: 'platform' };
    }

    /** ALL tenants on the platform (cross-tenant). */
    @Get('tenants')
    async allTenants() {
        const list = await this.tenants.getTenants();
        return {
            total: list.length,
            tenants: list.map((t: any) => ({ id: t.id, name: t.name, slug: t.slug })),
        };
    }

    /** ALL users across every tenant (cross-tenant; not tenant-filtered). */
    @Get('users')
    async allUsers() {
        const [users, total] = await this.users.getUsersAndCount({ take: 100 });
        return { total, users: users.map((u) => ({ id: u.id, email: u.email })) };
    }

    /** Platform-wide counts. */
    @Get('stats')
    async stats() {
        const [, userCount] = await this.users.getUsersAndCount({ take: 1 });
        const tenants = await this.tenants.getTenants();
        return { users: userCount, tenants: tenants.length };
    }

    /**
     * Grant the platform `super_admin` role to another user.
     *
     * Privilege-escalation control: a tenant user can never reach this route (the
     * class-level platform-role guard blocks them), so only an existing platform
     * admin can mint another one.
     */
    @Post('grant-admin')
    async grantAdmin(@Body() body: { email?: string }) {
        if (!body?.email) {
            throw new BadRequestException('email is required');
        }
        const target = await this.users.getUserByEmail(body.email).catch(() => null);
        if (!target) {
            throw new NotFoundException(`User ${body.email} not found`);
        }
        const role = await this.roles.getRoleByName(PLATFORM_SUPER_ADMIN_ROLE, PLATFORM_GUARD);
        if (!role) {
            throw new NotFoundException('Platform role not found');
        }
        // First-class platform access (cross-tenant). The grantee gains access on
        // their next login from the platform portal (origin-locked by validate).
        const platformAccess = await target.getPlatformAccess(true);
        await platformAccess.assignRoles([role.id]);
        return { message: `Granted platform ${PLATFORM_SUPER_ADMIN_ROLE} to ${body.email}` };
    }
}

import { NestAuthUser } from '../user/entities/user.entity';
import { NestAuthIdentity } from '../user/entities/identity.entity';
import { NestAuthAccessKey } from '../user/entities/access-key.entity';
import { NestAuthTenant } from '../tenant/entities/tenant.entity';
import { NestAuthPlatformAccess } from '../user/entities/platform-access.entity';
import { NestAuthUserAccess } from '../user/entities/user-access.entity';
import { NestAuthRole } from '../role/entities/role.entity';
import { NestAuthRolePermission } from '../role/entities/role-permission.entity';
import { NestAuthMFASecret } from '../auth/entities/mfa-secret.entity';
import { NestAuthOTP } from '../auth/entities/otp.entity';
import { NestAuthSession } from '../session/entities/session.entity';
import { NestAuthPermission } from '../permission/entities/permission.entity';
import { NestAuthAdminUser } from '../admin-console/entities/admin-user.entity';
import { NestAuthTrustedDevice } from '../auth';
import { NestAuthBlockedEmailDomain } from '../auth/entities/blocked-email-domain.entity';

export * from '../user/entities/user.entity';
export * from '../user/entities/identity.entity';
export * from '../user/entities/access-key.entity';
export * from '../tenant/entities/tenant.entity';
export * from '../user/entities/user-access.entity';
export * from '../user/entities/platform-access.entity';
export * from '../role/entities/role.entity';
export * from '../role/entities/role-permission.entity';
export * from '../auth/entities/mfa-secret.entity';
export * from '../auth/entities/otp.entity';
export * from '../session/entities/session.entity';
export * from '../permission/entities/permission.entity';
export * from '../auth/entities/blocked-email-domain.entity';


export const NestAuthEntities = [
    NestAuthUser,
    NestAuthIdentity,
    NestAuthRole,
    NestAuthRolePermission,
    NestAuthTenant,
    NestAuthPlatformAccess,
    NestAuthUserAccess,
    NestAuthMFASecret,
    NestAuthSession,
    NestAuthOTP,
    NestAuthAccessKey,
    NestAuthPermission,
    NestAuthAdminUser,
    NestAuthTrustedDevice,
    NestAuthBlockedEmailDomain,
];

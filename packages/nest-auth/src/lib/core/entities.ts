import { NestAuthUser } from '../user/entities/user.entity';
import { NestAuthIdentity } from '../user/entities/identity.entity';
import { NestAuthAccessKey } from '../user/entities/access-key.entity';
import { NestAuthTenant } from '../tenant/entities/tenant.entity';
import { NestAuthRole } from '../role/entities/role.entity';
import { NestAuthMFASecret } from '../auth/entities/mfa-secret.entity';
import { NestAuthOTP } from '../auth/entities/otp.entity';
import { NestAuthSession } from '../session/entities/session.entity';
import { NestAuthPermission } from '../permission/entities/permission.entity';
import { AdminUser as NestAuthAdminUser } from '../admin-console/entities/admin-user.entity';
import { NestAuthTrustedDevice } from '../auth';

export * from '../user/entities/user.entity';
export * from '../user/entities/identity.entity';
export * from '../user/entities/access-key.entity';
export * from '../tenant/entities/tenant.entity';
export * from '../role/entities/role.entity';
export * from '../auth/entities/mfa-secret.entity';
export * from '../auth/entities/otp.entity';
export * from '../session/entities/session.entity';
export * from '../permission/entities/permission.entity';
export { AdminUser as NestAuthAdminUser } from '../admin-console/entities/admin-user.entity';

export const NestAuthEntities = [
    NestAuthUser,
    NestAuthIdentity,
    NestAuthRole,
    NestAuthTenant,
    NestAuthMFASecret,
    NestAuthSession,
    NestAuthOTP,
    NestAuthAccessKey,
    NestAuthPermission,
    NestAuthAdminUser,
    NestAuthTrustedDevice,
];

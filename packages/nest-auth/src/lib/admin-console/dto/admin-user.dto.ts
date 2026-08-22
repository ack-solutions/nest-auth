import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
  ValidateIf,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Roles to set for one tenant (used in bulk update). */
export class AdminTenantRolesDto {
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[];
}

export class AdminCreateUserDto {
  @IsEmail()
  email: string;

  /** Required when tenant is enabled and mode is ISOLATED. Omit when mode is SHARED (assign tenant in edit). */
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
    { message: 'Password must contain uppercase, lowercase, number, and special character' }
  )
  password?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  emailVerifiedAt?: Date;

  @IsOptional()
  phoneVerifiedAt?: Date;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  /**
   * Provision this user as a PLATFORM (super-admin) user — a tenant-less account
   * carrying a `NestAuthPlatformAccess` marker (see
   * {@link AdminUpdateUserDto.isPlatformUser}). Platform users are tenant-less,
   * so `tenantId` is ignored when this is set.
   *
   * Requires `platformAccess.enabled` in the module config; otherwise rejected
   * with 400 PLATFORM_ACCESS_DISABLED.
   */
  @IsOptional()
  @IsBoolean()
  isPlatformUser?: boolean;
}

export class AdminUpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  emailVerifiedAt?: Date;

  @IsOptional()
  phoneVerifiedAt?: Date;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
    { message: 'Password must contain uppercase, lowercase, number, and special character' }
  )
  password?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isMfaEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  emailLoginEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  phoneLoginEnabled?: boolean;

  /** SHARED mode only: set user's tenant memberships (add/remove tenants). Ignored in ISOLATED mode. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tenantIds?: string[];

  /** Set roles per tenant. Each entry: { tenantId, roleIds }. Applied in both SHARED and ISOLATED mode. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminTenantRolesDto)
  tenantRoles?: AdminTenantRolesDto[];

  /**
   * Global role IDs when tenants are disabled (single-tenant / no-tenant mode).
   * Stored on the user's access where tenantId is NULL.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[];

  /**
   * Platform-wide role IDs, stored on the user's `NestAuthPlatformAccess` row —
   * a scope entirely separate from tenant roles (`tenantRoles`) and from the
   * tenant-less global roles (`roleIds`).
   *
   * Roles-only by design: this sets the roles of an EXISTING platform user and
   * never creates or removes the platform-access marker. Provisioning a platform
   * user stays in application code (`UserService.createPlatformUser`) so the
   * admin console is not a privilege-escalation path to minting super-admins.
   * Sending this for a non-platform user is rejected with 400 NOT_PLATFORM_USER.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platformRoleIds?: string[];

  /**
   * Grant (`true`) or revoke (`false`) PLATFORM access — the
   * `NestAuthPlatformAccess` marker that makes a user a platform (super-admin)
   * user. Revoking deletes the marker and, with it, that user's platform roles;
   * their tenant memberships and roles are untouched.
   *
   * Requires `platformAccess.enabled` in the module config; otherwise rejected
   * with 400 PLATFORM_ACCESS_DISABLED. Applied BEFORE `platformRoleIds`, so a
   * single request can grant access and set roles together.
   */
  @IsOptional()
  @IsBoolean()
  isPlatformUser?: boolean;
}

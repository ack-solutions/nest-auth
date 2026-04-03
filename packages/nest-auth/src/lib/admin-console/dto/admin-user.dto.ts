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
}

import { IsString, IsNotEmpty, IsOptional, IsObject, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminCreatePermissionDto {
    @ApiProperty({
        description: 'Permission name (must be unique per guard)',
        example: 'users.create',
        minLength: 1,
        maxLength: 255,
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(1)
    @MaxLength(255)
    name: string;

    @ApiProperty({
        description: 'Guard name (defaults to "web" if not provided)',
        required: false,
        example: 'web',
    })
    @IsOptional()
    @IsString()
    guard?: string;

    @ApiProperty({
        description: 'Optional description of what this permission allows',
        required: false,
        example: 'Allows creating new user accounts',
    })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({
        description: 'Optional category to group permissions (e.g., "users", "posts", "admin")',
        required: false,
        example: 'users',
    })
    @IsOptional()
    @IsString()
    category?: string;

    @ApiProperty({
        description: 'Optional metadata for additional permission information',
        required: false,
        example: { level: 'write', resource: 'users' },
    })
    @IsOptional()
    @IsObject()
    metadata?: Record<string, any>;
}

export class AdminUpdatePermissionDto {
    @ApiProperty({
        description: 'Permission name (must be unique per guard if changed). If changed, can optionally update in all roles.',
        required: false,
        example: 'users.create',
    })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(255)
    name?: string;

    @ApiProperty({
        description: 'Guard name',
        required: false,
        example: 'web',
    })
    @IsOptional()
    @IsString()
    guard?: string;

    @ApiProperty({
        description: 'Whether to update permission name in all roles that use it (only if name is being changed)',
        required: false,
        default: false,
    })
    @IsOptional()
    updateInRoles?: boolean;

    @ApiProperty({
        description: 'Optional description of what this permission allows',
        required: false,
    })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({
        description: 'Optional category to group permissions',
        required: false,
    })
    @IsOptional()
    @IsString()
    category?: string;

    @ApiProperty({
        description: 'Optional metadata',
        required: false,
    })
    @IsOptional()
    @IsObject()
    metadata?: Record<string, any>;
}

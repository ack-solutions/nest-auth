/**
 * Profile DTOs
 * 
 * Data Transfer Objects for profile management.
 * Separates input (UpdateProfileDto) from output (ProfileResponseDto).
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength, IsUrl } from 'class-validator';

/**
 * Update Profile Request DTO
 * Validates incoming profile update data
 */
export class UpdateProfileDto {
    @ApiPropertyOptional({
        description: 'User first name',
        example: 'John',
        minLength: 1,
        maxLength: 100,
    })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    firstName?: string;

    @ApiPropertyOptional({
        description: 'User last name',
        example: 'Doe',
        minLength: 1,
        maxLength: 100,
    })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    lastName?: string;

    @ApiPropertyOptional({
        description: 'User display name or nickname',
        example: 'johnd',
        minLength: 1,
        maxLength: 50,
    })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(50)
    displayName?: string;

    @ApiPropertyOptional({
        description: 'URL to user avatar image',
        example: 'https://example.com/avatars/johnd.jpg',
    })
    @IsOptional()
    @IsUrl()
    avatarUrl?: string;

    @ApiPropertyOptional({
        description: 'User phone number',
        example: '+1234567890',
    })
    @IsOptional()
    @IsString()
    phone?: string;
}

/**
 * Profile Response DTO
 * Structured response for profile data
 */
export class ProfileResponseDto {
    @ApiProperty({
        description: 'User ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    id: string;

    @ApiProperty({
        description: 'User email address',
        example: 'john@example.com',
    })
    email: string;

    @ApiPropertyOptional({
        description: 'User first name',
        example: 'John',
    })
    firstName?: string;

    @ApiPropertyOptional({
        description: 'User last name',
        example: 'Doe',
    })
    lastName?: string;

    @ApiPropertyOptional({
        description: 'Full name (computed)',
        example: 'John Doe',
    })
    fullName?: string;

    @ApiPropertyOptional({
        description: 'Display name',
        example: 'johnd',
    })
    displayName?: string;

    @ApiPropertyOptional({
        description: 'Avatar URL',
        example: 'https://example.com/avatars/johnd.jpg',
    })
    avatarUrl?: string;

    @ApiPropertyOptional({
        description: 'Phone number',
        example: '+1234567890',
    })
    phone?: string;

    @ApiProperty({
        description: 'Whether email is verified',
        example: true,
    })
    isVerified: boolean;

    @ApiProperty({
        description: 'Whether MFA is enabled',
        example: false,
    })
    isMfaEnabled: boolean;

    @ApiProperty({
        description: 'Account creation date',
        example: '2024-01-15T09:00:00Z',
    })
    createdAt: Date;

    @ApiPropertyOptional({
        description: 'Last profile update date',
        example: '2024-01-20T14:30:00Z',
    })
    updatedAt?: Date;
}

/**
 * Update Profile Response
 * Includes success message and updated profile
 */
export class UpdateProfileResponseDto {
    @ApiProperty({
        description: 'Success message',
        example: 'Profile updated successfully',
    })
    message: string;

    @ApiProperty({
        description: 'Updated profile data',
        type: ProfileResponseDto,
    })
    profile: ProfileResponseDto;
}

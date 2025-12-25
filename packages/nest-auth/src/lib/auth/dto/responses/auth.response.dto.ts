import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    ITokensResponse,
    IUserResponse,
    IAuthResponse,
    IVerify2faResponse,
    MFAMethodEnum
} from '@libs/auth-types';

/**
 * Authentication tokens response
 */
export class AuthTokensResponseDto implements ITokensResponse {
    @ApiProperty({
        description: 'JWT access token (short-lived)',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJpYXQiOjE2OTk5OTk5OTksImV4cCI6MTY5OTk5OTk5OX0.xyz',
    })
    accessToken: string;

    @ApiProperty({
        description: 'JWT refresh token (long-lived)',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJ0eXBlIjoicmVmcmVzaCIsImlhdCI6MTY5OTk5OTk5OX0.abc',
    })
    refreshToken: string;
}

/**
 * User information response
 */
export class UserResponseDto implements IUserResponse {
    @ApiProperty({
        description: 'User unique identifier',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    id: string;

    @ApiPropertyOptional({
        description: 'User email address',
        example: 'user@example.com',
    })
    email?: string;

    @ApiPropertyOptional({
        description: 'User phone number',
        example: '+1234567890',
    })
    phone?: string;

    @ApiProperty({
        description: 'Email verification status',
        example: true,
    })
    isVerified: boolean;

    @ApiPropertyOptional({
        description: 'Additional user metadata',
        example: { firstName: 'John', lastName: 'Doe' },
    })
    metadata?: Record<string, any>;
}

/**
 * Authentication Response with Tokens DTO
 *
 * Used in header mode (accessTokenType: 'header')
 * Returns tokens in the response body along with message and status.
 */
export class AuthWithTokensResponseDto extends AuthTokensResponseDto implements IAuthResponse {
    @ApiPropertyOptional({
        description: 'Success message (added by controller based on configuration)',
        example: 'Login successful',
    })
    message?: string;

    @ApiProperty({
        description: 'Whether multi-factor authentication is required',
        example: false,
    })
    isRequiresMfa: boolean;

    @ApiPropertyOptional({
        description: 'Available MFA methods when isRequiresMfa is true',
        example: ['email', 'totp'],
        enum: MFAMethodEnum,
        isArray: true,
    })
    mfaMethods?: MFAMethodEnum[];

    @ApiPropertyOptional({
        description: 'Default/recommended MFA method',
        example: 'email',
        enum: MFAMethodEnum,
    })
    defaultMfaMethod?: MFAMethodEnum;

    @ApiPropertyOptional({
        description: 'User information',
        type: UserResponseDto,
    })
    user?: UserResponseDto;
}

// Alias for backward compatibility
export type AuthResponseDto = AuthWithTokensResponseDto;

/**
 * Two-factor Authentication Response with Tokens DTO
 *
 * Used in header mode (accessTokenType: 'header')
 * Returns tokens in the response body after successful 2FA verification.
 */
export class Verify2faWithTokensResponseDto extends AuthTokensResponseDto implements IVerify2faResponse {
    @ApiPropertyOptional({
        description: 'Verification success message (added by controller)',
        example: '2FA verification successful',
    })
    message?: string;
}

// Alias for backward compatibility
export type Verify2faResponseDto = Verify2faWithTokensResponseDto;

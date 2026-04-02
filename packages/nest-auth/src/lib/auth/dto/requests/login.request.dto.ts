import { IsString, IsUUID, IsOptional, IsObject, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, ApiExtraModels, getSchemaPath } from '@nestjs/swagger';
import { EmailCredentialsDto } from '../credentials/email-credentials.dto';
import { PhoneCredentialsDto } from '../credentials/phone-credentials.dto';
import { SocialCredentialsDto } from '../credentials/social-credentials.dto';
import { PasswordlessOtpCredentialsDto } from '../credentials/passwordless-otp-credentials.dto';
import { ILoginRequest } from '@ackplus/nest-auth-contracts';

/**
 * Login request DTO supporting multiple authentication providers
 */
@ApiExtraModels(
    EmailCredentialsDto,
    PhoneCredentialsDto,
    SocialCredentialsDto,
    PasswordlessOtpCredentialsDto,
)
export class NestAuthLoginRequestDto implements ILoginRequest {

    @ApiPropertyOptional({
        description: 'Authentication provider name',
        example: 'email',
        enum: ['email', 'phone', 'passwordless', 'google', 'facebook', 'apple', 'github'],
        default: 'email',
    })
    @IsString()
    @IsOptional()
    providerName?: string;

    @ApiProperty({
        description: 'Login credentials - type varies by provider',
        required: true,
        examples: {
            emailLogin: {
                summary: 'Email + password',
                value: { email: 'user@example.com', password: 'SecurePass123!' },
            },
            phoneLogin: {
                summary: 'Phone + password',
                value: { phone: '+1234567890', password: 'SecurePass123!' },
            },
            passwordlessOtp: {
                summary: 'Passwordless OTP — set providerName to passwordless (after POST /auth/passwordless/send)',
                value: {
                    providerName: 'passwordless',
                    credentials: {
                        identifier: 'user@example.com',
                        channels: ['email', 'sms'],
                        code: '123456',
                    },
                },
            },
            socialLogin: {
                summary: 'Social Login (Google/Facebook/etc)',
                value: { token: 'ya29.a0AfH6SMBx...', type: 'idToken' }, // type is optional
            },
        },
        oneOf: [
            { $ref: getSchemaPath(EmailCredentialsDto) },
            { $ref: getSchemaPath(PhoneCredentialsDto) },
            { $ref: getSchemaPath(SocialCredentialsDto) },
            { $ref: getSchemaPath(PasswordlessOtpCredentialsDto) },
        ],
    })
    @IsObject()
    credentials:
        | EmailCredentialsDto
        | PhoneCredentialsDto
        | SocialCredentialsDto
        | PasswordlessOtpCredentialsDto
        | Record<string, any>;

    @ApiPropertyOptional({
        description: 'Tenant ID for multi-tenant applications',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsUUID()
    @IsOptional()
    tenantId?: string;

    @ApiPropertyOptional({
        description: 'Guard context (e.g. admin, web, vendor) for isolation. Deprecated: use client',
        example: 'admin',
        deprecated: true
    })
    @IsString()
    @IsOptional()
    guard?: string;

    @ApiPropertyOptional({
        description: 'Auto-create user if not exists (for social auth)',
        default: false,
    })
    @IsBoolean()
    @IsOptional()
    createUserIfNotExists?: boolean;
}

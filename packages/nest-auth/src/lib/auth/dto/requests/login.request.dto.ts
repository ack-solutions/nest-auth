import { IsString, IsUUID, IsOptional, IsObject, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, ApiExtraModels, getSchemaPath } from '@nestjs/swagger';
import { EmailCredentialsDto } from '../credentials/email-credentials.dto';
import { PhoneCredentialsDto } from '../credentials/phone-credentials.dto';
import { SocialCredentialsDto } from '../credentials/social-credentials.dto';
import { ILoginRequest } from '@ackplus/nest-auth-contracts';

/**
 * Login request DTO supporting multiple authentication providers
 */
@ApiExtraModels(EmailCredentialsDto, PhoneCredentialsDto, SocialCredentialsDto)
export class NestAuthLoginRequestDto implements ILoginRequest {

    @ApiPropertyOptional({
        description: 'Authentication provider name',
        example: 'email',
        enum: ['email', 'phone', 'google', 'facebook', 'apple', 'github'],
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
                summary: 'Email Login',
                value: { email: 'user@example.com', password: 'SecurePass123!' },
            },
            phoneLogin: {
                summary: 'Phone Login',
                value: { phone: '+1234567890', password: 'SecurePass123!' },
            },
            socialLogin: {
                summary: 'Social Login (Google/Facebook/etc)',
                value: { token: 'ya29.a0AfH6SMBx...' },
            },
        },
        oneOf: [
            { $ref: getSchemaPath(EmailCredentialsDto) },
            { $ref: getSchemaPath(PhoneCredentialsDto) },
            { $ref: getSchemaPath(SocialCredentialsDto) },
        ],
    })
    @IsObject()
    credentials: EmailCredentialsDto | PhoneCredentialsDto | SocialCredentialsDto | Record<string, any>;

    @ApiPropertyOptional({
        description: 'Tenant ID for multi-tenant applications',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsUUID()
    @IsOptional()
    tenantId?: string;

    @ApiPropertyOptional({
        description: 'Auto-create user if not exists (for social auth)',
        default: false,
    })
    @IsBoolean()
    @IsOptional()
    createUserIfNotExists?: boolean;
}

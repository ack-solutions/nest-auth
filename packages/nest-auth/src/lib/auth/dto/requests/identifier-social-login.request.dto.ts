import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { IIdentifierSocialLoginRequest } from '@ackplus/nest-auth-contracts';
import { SocialCredentialsDto } from '../credentials/social-credentials.dto';

export class NestAuthIdentifierSocialLoginRequestDto implements IIdentifierSocialLoginRequest {
    @ApiPropertyOptional({
        description: 'Lookup token returned by /auth/login/lookup',
    })
    @IsString()
    @IsOptional()
    lookupToken?: string;

    @ApiPropertyOptional({
        description: 'Tenant ID override',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsUUID()
    @IsOptional()
    tenantId?: string;

    @ApiPropertyOptional({
        description: 'Tenant slug override',
        example: 'acme',
    })
    @IsString()
    @IsOptional()
    tenantSlug?: string;

    @ApiProperty({
        description: 'Social provider name',
        example: 'google',
    })
    @IsString()
    @IsNotEmpty()
    providerName: string;

    @ApiProperty({
        description: 'Social login credentials',
        type: SocialCredentialsDto,
    })
    @IsObject()
    credentials: SocialCredentialsDto;

    @ApiPropertyOptional({
        description: 'Auto-create user if not exists',
        default: false,
    })
    @IsBoolean()
    @IsOptional()
    createUserIfNotExists?: boolean;

    @ApiPropertyOptional({
        description: 'Guard context for role isolation',
        example: 'admin',
    })
    @IsString()
    @IsOptional()
    guard?: string;
}

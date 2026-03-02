import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { IIdentifierOtpLoginVerifyRequest } from '@ackplus/nest-auth-contracts';

export class NestAuthIdentifierOtpVerifyRequestDto implements IIdentifierOtpLoginVerifyRequest {
    @ApiPropertyOptional({
        description: 'Lookup token returned by /auth/login/lookup',
    })
    @IsString()
    @IsOptional()
    lookupToken?: string;

    @ApiPropertyOptional({
        description: 'Identifier (email or phone). Required if lookupToken is not provided.',
        example: 'user@example.com',
    })
    @IsString()
    @IsOptional()
    identifier?: string;

    @ApiProperty({
        description: 'One-time password for login',
        example: '123456',
    })
    @IsString()
    @IsNotEmpty()
    otp: string;

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

    @ApiPropertyOptional({
        description: 'Whether to trust this device (for MFA follow-up)',
        example: false,
    })
    @IsBoolean()
    @IsOptional()
    trustDevice?: boolean;

    @ApiPropertyOptional({
        description: 'Guard context for role isolation',
        example: 'admin',
    })
    @IsString()
    @IsOptional()
    guard?: string;
}

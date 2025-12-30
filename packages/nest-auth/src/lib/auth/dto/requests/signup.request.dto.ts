import { IsEmail, IsString, IsOptional, IsNotEmpty, MinLength, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ISignupRequest } from '@ackplus/nest-auth-contracts';

export class NestAuthSignupRequestDto implements ISignupRequest {
    [x: string]: any;

    @ApiPropertyOptional({
        description: 'User email address (required if phone not provided)',
        example: 'user@example.com',
    })
    @ValidateIf(o => !o.phone)
    @IsEmail()
    @IsNotEmpty()
    email?: string;

    @ApiPropertyOptional({
        description: 'User phone number (required if email not provided)',
        example: '+1234567890',
    })
    @ValidateIf(o => !o.email)
    @IsString()
    @IsNotEmpty()
    phone?: string;

    @ApiProperty({
        description: 'User password',
        example: 'SecurePass123!',
        minLength: 8,
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    password: string;

    @ApiPropertyOptional({
        description: 'Tenant ID for multi-tenant applications',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsString()
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
}

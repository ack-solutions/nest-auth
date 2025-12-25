import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsPhoneNumber, ValidateIf, IsUUID, IsOptional } from 'class-validator';
import { IForgotPasswordRequest } from '@libs/auth-types';

export class ForgotPasswordRequestDto implements IForgotPasswordRequest {
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
    @IsPhoneNumber()
    @IsNotEmpty()
    phone?: string;

    @ApiPropertyOptional({
        description: 'Tenant ID for multi-tenant applications',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsUUID()
    @IsOptional()
    tenantId?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsPhoneNumber, IsString, ValidateIf, IsUUID, IsOptional, MinLength } from 'class-validator';

export class ResetPasswordRequestDto {
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

    @ApiProperty({
        description: 'One-time password (OTP) received via email or SMS',
        example: '123456',
        minLength: 6,
        maxLength: 8,
    })
    @IsString()
    @IsNotEmpty()
    otp: string;

    @ApiProperty({
        description: 'New password',
        example: 'NewSecurePass123!',
        minLength: 8,
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    newPassword: string;

    @ApiPropertyOptional({
        description: 'Tenant ID for multi-tenant applications',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsUUID()
    @IsOptional()
    tenantId?: string;
}

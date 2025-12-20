import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsPhoneNumber, IsString, IsUUID, ValidateIf } from "class-validator";
import { MFAMethodEnum } from "../../../core";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class VerifyForgotPasswordOtpRequestDto {
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
        description: 'One-time password code received via email or SMS',
        example: '123456',
        minLength: 6,
        maxLength: 8,
    })
    @IsString()
    @IsNotEmpty()
    otp: string;

    @ApiPropertyOptional({
        description: 'Tenant ID for multi-tenant applications',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsUUID()
    @IsOptional()
    tenantId?: string;
}

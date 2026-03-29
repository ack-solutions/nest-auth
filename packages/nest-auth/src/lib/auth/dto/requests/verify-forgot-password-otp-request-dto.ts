
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsPhoneNumber, IsString, IsUUID, ValidateIf } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IVerifyForgotPasswordOtpRequest } from "@ackplus/nest-auth-contracts";

export class NestAuthVerifyForgotPasswordOtpRequestDto implements IVerifyForgotPasswordOtpRequest {
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
        description: 'Verification or magic-link code (matches OTP entity `code`)',
        example: '123456',
        minLength: 6,
        maxLength: 8,
    })
    @IsString()
    @IsNotEmpty()
    code: string;

    @ApiPropertyOptional({
        description: 'Tenant ID for multi-tenant applications',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsUUID()
    @IsOptional()
    tenantId?: string;
}

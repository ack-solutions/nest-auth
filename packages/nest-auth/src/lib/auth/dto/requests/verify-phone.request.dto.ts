import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';
import { IVerifyPhoneRequest } from '@ackplus/nest-auth-contracts';

export class NestAuthVerifyPhoneRequestDto implements IVerifyPhoneRequest {
    @ApiProperty({
        description: 'Verification code received via SMS (matches OTP entity `code`)',
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

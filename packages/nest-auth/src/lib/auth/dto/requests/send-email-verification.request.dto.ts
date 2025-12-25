import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional } from 'class-validator';
import { ISendEmailVerificationRequest } from '@libs/auth-types';

export class SendEmailVerificationRequestDto implements ISendEmailVerificationRequest {
    @ApiPropertyOptional({
        description: 'Tenant ID for multi-tenant applications',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsUUID()
    @IsOptional()
    tenantId?: string;
}

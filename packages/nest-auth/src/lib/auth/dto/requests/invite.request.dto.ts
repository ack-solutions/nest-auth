import { IsEmail, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class NestAuthInviteRequestDto {
    @ApiPropertyOptional({ description: 'Email address to invite', example: 'member@acme.test' })
    @IsEmail()
    @IsOptional()
    email?: string;

    @ApiPropertyOptional({ description: 'Phone number to invite', example: '+15551234567' })
    @IsString()
    @IsOptional()
    phone?: string;

    @ApiPropertyOptional({
        description: 'Tenant to invite the member into (ISOLATED: the same email is a distinct account per tenant).',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsUUID()
    @IsOptional()
    tenantId?: string;

    @ApiPropertyOptional({ description: 'Optional metadata stored on a new user and echoed on the invite event for your email template.' })
    @IsObject()
    @IsOptional()
    metadata?: Record<string, any>;
}

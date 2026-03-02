import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { IIdentifierLookupRequest } from '@ackplus/nest-auth-contracts';

export class NestAuthIdentifierLookupRequestDto implements IIdentifierLookupRequest {
    @ApiProperty({
        description: 'Identifier used for login discovery (email or phone)',
        example: 'user@example.com',
    })
    @IsString()
    @IsNotEmpty()
    identifier: string;

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
        description: 'Guard context for role isolation',
        example: 'admin',
    })
    @IsString()
    @IsOptional()
    guard?: string;
}

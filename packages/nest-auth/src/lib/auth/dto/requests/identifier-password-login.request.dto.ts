import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { IIdentifierPasswordLoginRequest } from '@ackplus/nest-auth-contracts';

export class NestAuthIdentifierPasswordLoginRequestDto implements IIdentifierPasswordLoginRequest {
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
        description: 'User password',
        example: 'SecurePass123!',
    })
    @IsString()
    @IsNotEmpty()
    password: string;

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

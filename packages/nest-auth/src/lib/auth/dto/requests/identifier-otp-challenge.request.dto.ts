import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { IIdentifierOtpLoginChallengeRequest } from '@ackplus/nest-auth-contracts';

export class NestAuthIdentifierOtpChallengeRequestDto implements IIdentifierOtpLoginChallengeRequest {
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
}

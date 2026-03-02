import { ApiProperty } from '@nestjs/swagger';
import {
    IIdentifierLookupResponse,
    IIdentifierLookupTenant,
    IIdentifierLoginMethod,
    IIdentifierType,
} from '@ackplus/nest-auth-contracts';

export class IdentifierLookupTenantDto implements IIdentifierLookupTenant {
    @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
    id: string;

    @ApiProperty({ example: 'acme' })
    slug?: string;

    @ApiProperty({ example: 'Acme Inc' })
    name?: string;
}

export class IdentifierLookupResponseDto implements IIdentifierLookupResponse {
    @ApiProperty({ example: 'Lookup successful' })
    message: string;

    @ApiProperty({ example: 'user@example.com' })
    identifier: string;

    @ApiProperty({ example: 'email', enum: ['email', 'phone'] })
    identifierType: IIdentifierType;

    @ApiProperty({ description: 'Lookup token for login follow-up operations' })
    lookupToken: string;

    @ApiProperty({ nullable: true, example: '123e4567-e89b-12d3-a456-426614174000' })
    resolvedTenantId?: string | null;

    @ApiProperty({ example: false })
    requiresTenantSelection: boolean;

    @ApiProperty({ type: [IdentifierLookupTenantDto] })
    tenants: IdentifierLookupTenantDto[];

    @ApiProperty({
        isArray: true,
        enum: ['password', 'otp', 'magic_link', 'social'],
        example: ['password', 'otp', 'magic_link', 'social'],
    })
    availableMethods: IIdentifierLoginMethod[];
}

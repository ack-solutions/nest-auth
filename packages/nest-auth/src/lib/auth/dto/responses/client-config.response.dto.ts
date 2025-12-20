import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RegistrationCollectProfileField } from '../../../core/interfaces/auth-module-options.interface';

export class EmailAuthConfigDto {
    @ApiProperty({ example: true })
    enabled: boolean;
}

export class PhoneAuthConfigDto {
    @ApiProperty({ example: false })
    enabled: boolean;
}

export class RegistrationConfigDto {
    @ApiProperty({ example: true, description: 'Whether user registration is enabled' })
    enabled: boolean;

    @ApiPropertyOptional({ example: false, description: 'Whether registration requires an invitation' })
    requireInvitation?: boolean;

    @ApiPropertyOptional({
        description: 'Additional profile fields to collect during registration',
        type: 'array',
        items: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                label: { type: 'string' },
                required: { type: 'boolean' },
                type: { type: 'string', enum: ['text', 'email', 'phone', 'select', 'checkbox', 'password'] },
                placeholder: { type: 'string' },
                options: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            label: { type: 'string' },
                            value: { type: 'string' },
                        },
                    },
                },
            },
        },
    })
    collectProfileFields?: Array<RegistrationCollectProfileField>;
}

export class MfaConfigDto {
    @ApiProperty({ example: true })
    enabled: boolean;

    @ApiPropertyOptional({ example: ['email', 'totp'], isArray: true })
    methods?: string[];

    @ApiPropertyOptional({ example: true })
    allowUserToggle?: boolean;

    @ApiPropertyOptional({ example: true })
    allowMethodSelection?: boolean;
}

export class TenantOptionDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    name: string;

    @ApiProperty()
    slug: string;

    @ApiProperty()
    isActive: boolean;

    @ApiPropertyOptional()
    metadata?: Record<string, any>;
}

export class TenantsConfigDto {
    @ApiProperty({ example: 'single', enum: ['single', 'multi'] })
    mode: 'single' | 'multi';

    @ApiPropertyOptional({ nullable: true })
    defaultTenantId: string | null;

    @ApiPropertyOptional({ type: [TenantOptionDto] })
    options?: TenantOptionDto[];
}

export class SsoProviderConfigDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    name: string;

    @ApiPropertyOptional()
    logoUrl?: string;

    @ApiPropertyOptional()
    authorizationUrl?: string;

    @ApiPropertyOptional()
    clientId?: string;

    @ApiPropertyOptional()
    hint?: string;
}

export class SsoConfigDto {
    @ApiProperty({ example: false })
    enabled: boolean;

    @ApiPropertyOptional({ type: [SsoProviderConfigDto] })
    providers?: SsoProviderConfigDto[];
}

export class UiConfigDto {
    @ApiPropertyOptional()
    brandName?: string;

    @ApiPropertyOptional()
    brandColor?: string;

    @ApiPropertyOptional()
    logoUrl?: string;

    @ApiPropertyOptional()
    backgroundImageUrl?: string;
}

export class ClientConfigResponseDto {
    @ApiProperty({ type: EmailAuthConfigDto })
    emailAuth: EmailAuthConfigDto;

    @ApiProperty({ type: PhoneAuthConfigDto })
    phoneAuth: PhoneAuthConfigDto;

    @ApiProperty({ type: RegistrationConfigDto })
    registration: RegistrationConfigDto;

    @ApiProperty({ type: MfaConfigDto })
    mfa: MfaConfigDto;

    @ApiProperty({ type: TenantsConfigDto })
    tenants: TenantsConfigDto;

    @ApiProperty({ type: SsoConfigDto })
    sso: SsoConfigDto;

    @ApiPropertyOptional({ type: UiConfigDto })
    ui?: UiConfigDto;
}

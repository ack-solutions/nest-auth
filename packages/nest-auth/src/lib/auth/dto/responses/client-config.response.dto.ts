import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IRegistrationCollectProfileField } from '../../../core/interfaces/auth-module-options.interface';
import {
    IEmailAuthConfig,
    IPhoneAuthConfig,
    IRegistrationConfig,
    IMfaConfig,
    ITenantOption,
    ITenantsConfig,
    ISsoProviderConfig,
    ISsoConfig,
    IUiConfig,
} from '@ackplus/nest-auth-contracts';

export class EmailAuthConfigDto implements IEmailAuthConfig {
    @ApiProperty({ example: true })
    enabled: boolean;
}

export class PhoneAuthConfigDto implements IPhoneAuthConfig {
    @ApiProperty({ example: false })
    enabled: boolean;
}

export class RegistrationConfigDto implements IRegistrationConfig {
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
    collectProfileFields?: Array<IRegistrationCollectProfileField>;
}

export class MfaConfigDto implements IMfaConfig {
    @ApiProperty({ example: true })
    enabled: boolean;

    @ApiPropertyOptional({ example: ['email', 'totp'], isArray: true })
    methods?: any[]; // Using any[] here to avoid circular dependency or import issues with MFAMethodEnum if complex

    @ApiPropertyOptional({ example: true })
    allowUserToggle?: boolean;

    @ApiPropertyOptional({ example: true })
    allowMethodSelection?: boolean;
}

export class TenantOptionDto implements ITenantOption {
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

export class TenantsConfigDto implements ITenantsConfig {
    @ApiProperty({ example: 'single', enum: ['single', 'multi'] })
    mode: 'single' | 'multi';

    @ApiPropertyOptional({ nullable: true })
    defaultTenantId: string | null;

    @ApiPropertyOptional({ type: [TenantOptionDto] })
    options?: TenantOptionDto[];
}

export class SsoProviderConfigDto implements ISsoProviderConfig {
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

export class SsoConfigDto implements ISsoConfig {
    @ApiProperty({ example: false })
    enabled: boolean;

    @ApiPropertyOptional({ type: [SsoProviderConfigDto] })
    providers?: SsoProviderConfigDto[];
}

export class UiConfigDto implements IUiConfig {
    @ApiPropertyOptional()
    brandName?: string;

    @ApiPropertyOptional()
    brandColor?: string;

    @ApiPropertyOptional()
    logoUrl?: string;

    @ApiPropertyOptional()
    backgroundImageUrl?: string;
}

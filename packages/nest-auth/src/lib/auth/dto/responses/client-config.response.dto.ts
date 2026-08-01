import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IEmailAuthConfig,
    IPhoneAuthConfig,
    IPasswordlessAuthConfig,
    IOAuthProviderPublicConfig,
    IRegistrationConfig,
    IMfaConfig,
    IMultipleAccountsConfig,
    IPlatformAccessPublicConfig,
    ITenantOption,
    ITenantsConfig,
    ISsoProviderConfig,
    ISsoConfig,
    IUiConfig,
    TenantModeEnum,
    IProfileField,
} from '@ackplus/nest-auth-contracts';

export class EmailAuthConfigDto implements IEmailAuthConfig {
    @ApiProperty({ example: true })
    enabled: boolean;
}

export class PhoneAuthConfigDto implements IPhoneAuthConfig {
    @ApiProperty({ example: false })
    enabled: boolean;
}

export class PasswordlessAuthConfigDto implements IPasswordlessAuthConfig {
    @ApiProperty({ example: false })
    enabled: boolean;

    @ApiPropertyOptional({ example: false })
    allowSignUp?: boolean;
}

export class OAuthProviderPublicConfigDto implements IOAuthProviderPublicConfig {
    @ApiProperty({ example: false })
    enabled: boolean;

    @ApiPropertyOptional({ example: '1234567890-abcdef.apps.googleusercontent.com' })
    clientId?: string;

    @ApiPropertyOptional({ example: '123456789012345', description: 'Facebook app id (when provider is Facebook)' })
    appId?: string;
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
    collectProfileFields?: IProfileField[];
}

export class MfaConfigDto implements IMfaConfig {
    @ApiProperty({ example: true })
    enabled: boolean;

    @ApiPropertyOptional({ example: ['email', 'totp'], isArray: true })
    methods?: any[];

    @ApiPropertyOptional({ example: true })
    allowUserToggle?: boolean;

    @ApiPropertyOptional({ example: true })
    allowMethodSelection?: boolean;
}

export class MultipleAccountsConfigDto implements IMultipleAccountsConfig {
    @ApiProperty({ example: false })
    enabled: boolean;
}

export class PlatformAccessPublicConfigDto implements IPlatformAccessPublicConfig {
    @ApiProperty({ example: false })
    enabled: boolean;
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
    @ApiPropertyOptional({ example: true })
    enabled?: boolean;

    @ApiProperty({ example: TenantModeEnum.ISOLATED, enum: TenantModeEnum })
    mode: TenantModeEnum;

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

/** Swagger shape for `GET /auth/client-config`. */
export class ClientConfigResponseDto {
    @ApiPropertyOptional({ type: TenantsConfigDto })
    tenants?: TenantsConfigDto;

    @ApiPropertyOptional({ type: MultipleAccountsConfigDto })
    multipleAccounts?: MultipleAccountsConfigDto;

    @ApiPropertyOptional({ type: [String], example: ['web', 'api'] })
    roleGuards?: string[];

    @ApiPropertyOptional({ type: EmailAuthConfigDto })
    emailAuth?: EmailAuthConfigDto;

    @ApiPropertyOptional({ type: PhoneAuthConfigDto })
    phoneAuth?: PhoneAuthConfigDto;

    @ApiPropertyOptional({ type: PasswordlessAuthConfigDto })
    passwordless?: PasswordlessAuthConfigDto;

    @ApiPropertyOptional({ type: OAuthProviderPublicConfigDto })
    google?: OAuthProviderPublicConfigDto;

    @ApiPropertyOptional({ type: OAuthProviderPublicConfigDto })
    facebook?: OAuthProviderPublicConfigDto;

    @ApiPropertyOptional({ type: OAuthProviderPublicConfigDto })
    apple?: OAuthProviderPublicConfigDto;

    @ApiPropertyOptional({ type: OAuthProviderPublicConfigDto })
    github?: OAuthProviderPublicConfigDto;

    @ApiPropertyOptional({ type: [String], example: ['ldap'] })
    customProviders?: string[];

    @ApiPropertyOptional({ type: RegistrationConfigDto })
    registration?: RegistrationConfigDto;

    @ApiPropertyOptional({ type: MfaConfigDto })
    mfa?: MfaConfigDto;

    @ApiPropertyOptional({ type: PlatformAccessPublicConfigDto })
    platformAccess?: PlatformAccessPublicConfigDto;

    @ApiPropertyOptional({ enum: ['header', 'cookie', null], example: 'header' })
    accessTokenType?: 'header' | 'cookie' | null;

    @ApiPropertyOptional({ type: SsoConfigDto })
    sso?: SsoConfigDto;

    @ApiPropertyOptional({ type: UiConfigDto })
    ui?: UiConfigDto;
}

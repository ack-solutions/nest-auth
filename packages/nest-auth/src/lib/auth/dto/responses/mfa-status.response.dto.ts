import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MFAMethodEnum } from '../../../core';
import { IMfaDevice, IMfaStatusResponse } from '@libs/auth-types';

export class MfaDeviceDto implements IMfaDevice {
    @ApiProperty({
        description: 'Unique identifier of the MFA device',
        example: '4b3c9c9c-9a9d-4d1e-8d9f-123456789abc',
    })
    id: string;

    @ApiProperty({
        description: 'Friendly name of the registered device',
        example: 'Work laptop',
    })
    deviceName: string;

    @ApiProperty({
        description: 'MFA method this device supports',
        enum: MFAMethodEnum,
        example: MFAMethodEnum.TOTP,
    })
    method: MFAMethodEnum;

    @ApiPropertyOptional({
        description: 'Timestamp of when the device was last used',
        example: '2024-05-20T12:34:56.000Z',
    })
    lastUsedAt?: Date | null;

    @ApiProperty({
        description: 'Whether the device setup has been verified',
        example: true,
    })
    verified: boolean;

    @ApiPropertyOptional({
        description: 'Timestamp of when the device was registered',
        example: '2024-05-18T10:15:00.000Z',
    })
    createdAt?: Date | null;
}

export class MfaStatusResponseDto implements IMfaStatusResponse {
    @ApiProperty({
        description: 'Whether MFA is currently enabled for the user',
        example: true,
    })
    isEnabled: boolean;

    @ApiProperty({
        description: 'MFA methods the user has verified and can currently use (includes EMAIL/SMS if configured, and TOTP if user has verified device)',
        enum: MFAMethodEnum,
        isArray: true,
        example: [MFAMethodEnum.EMAIL, MFAMethodEnum.TOTP],
    })
    verifiedMethods: MFAMethodEnum[];

    @ApiProperty({
        description: 'All MFA methods configured and available in the application (methods user can potentially set up)',
        enum: MFAMethodEnum,
        isArray: true,
        example: [MFAMethodEnum.EMAIL, MFAMethodEnum.TOTP, MFAMethodEnum.SMS],
    })
    configuredMethods: MFAMethodEnum[];

    @ApiProperty({
        description: 'Indicates if MFA toggling is allowed for the user',
        example: true,
    })
    allowUserToggle: boolean;

    @ApiProperty({
        description: 'Indicates if users can choose their preferred MFA method',
        example: true,
    })
    allowMethodSelection: boolean;

    @ApiProperty({
        description: 'Registered TOTP devices for the user',
        type: [MfaDeviceDto],
    })
    totpDevices: MfaDeviceDto[];

    @ApiProperty({
        description: 'Whether a recovery code has been generated for the user',
        example: false,
    })
    hasRecoveryCode: boolean;
}

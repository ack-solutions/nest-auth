import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Optional body for `POST /auth/mfa/setup-totp`. All fields are optional — with an
 * empty body the account label defaults to the user's email.
 */
export class NestAuthSetupTotpRequestDto {
    @ApiPropertyOptional({
        description:
            "Account label shown in the authenticator app (under the issuer). Defaults to the user's email. " +
            'Use it to disambiguate multiple accounts of the same person — e.g. `"ada@acme.com (Acme Corp)"` in a multi-tenant app.',
        example: 'ada@acme.com (Acme Corp)',
        maxLength: 128,
    })
    @IsOptional()
    @IsString()
    @MaxLength(128)
    label?: string;

    @ApiPropertyOptional({
        description: 'Human-readable name stored for this authenticator device (not shown in the app). Defaults to `{appName} : {email}`.',
        example: 'iPhone Authenticator',
        maxLength: 128,
    })
    @IsOptional()
    @IsString()
    @MaxLength(128)
    deviceName?: string;
}

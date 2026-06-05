import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

/**
 * Social login credentials (Google, Facebook, Apple, GitHub)
 */
export class SocialCredentialsDto {
    @ApiProperty({
        description: 'OAuth token or ID token from social provider',
        example: 'ya29.a0AfH6SMBx1234567890abcdefghijklmnop',
    })
    @IsString()
    @IsNotEmpty()
    token: string;


    @ApiProperty({
        description:
            'How to interpret the supplied token. Required only for Google: `idToken` (default) verifies a Google-signed ID token client-side; `accessToken` calls Google\'s userinfo endpoint with a Bearer access token. Other providers (Facebook, Apple, GitHub) ignore this field.',
        example: 'idToken',
        enum: ['idToken', 'accessToken'],
        default: 'idToken',
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsEnum(['idToken', 'accessToken'])
    type?: 'idToken' | 'accessToken';

    @ApiProperty({
        description:
            "Display name from the provider. Apple only returns the user's name on the FIRST native sign-in, so pass it here to persist it (ignored by other providers).",
        required: false,
        example: 'Ada Lovelace',
    })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({
        description:
            'Nonce used for native sign-in replay protection. When provided, it must match the `nonce` claim in the verified Apple identityToken.',
        required: false,
    })
    @IsOptional()
    @IsString()
    nonce?: string;
}

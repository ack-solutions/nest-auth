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
            "Full display name from the provider. Apple only returns the user's name on the FIRST native sign-in, so pass it here to persist it (ignored by other providers). Prefer `firstName`/`lastName` when you have them separately.",
        required: false,
        example: 'Ada Lovelace',
    })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({
        description:
            "User's given/first name captured by the frontend. Needed for Apple Sign In, which returns the name to the app ONLY on the first authorization (never in the id_token on later logins) — capture it then and send it here. Ignored by providers that already supply a name.",
        required: false,
        example: 'Ada',
    })
    @IsOptional()
    @IsString()
    firstName?: string;

    @ApiProperty({
        description:
            "User's family/last name captured by the frontend (see `firstName`). Needed for Apple Sign In on the first authorization.",
        required: false,
        example: 'Lovelace',
    })
    @IsOptional()
    @IsString()
    lastName?: string;

    @ApiProperty({
        description:
            'Avatar / profile-picture URL supplied by the frontend. Apple Sign In does NOT provide a photo, so pass one here only if your app sourced it elsewhere. Google returns its own `picture`, used as a fallback when this is omitted.',
        required: false,
        example: 'https://example.com/avatar/ada.png',
    })
    @IsOptional()
    @IsString()
    avatarUrl?: string;

    @ApiProperty({
        description:
            'Nonce used for native sign-in replay protection. When provided, it must match the `nonce` claim in the verified Apple identityToken.',
        required: false,
    })
    @IsOptional()
    @IsString()
    nonce?: string;
}

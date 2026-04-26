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
}

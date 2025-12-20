import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

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
    accessToken: string;
}

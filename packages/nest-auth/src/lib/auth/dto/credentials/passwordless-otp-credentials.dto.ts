import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    ArrayMinSize,
    ArrayUnique,
    IsArray,
    IsIn,
    IsNotEmpty,
    IsString,
} from 'class-validator';

/**
 * Passwordless OTP login — use with `providerName: 'passwordless'` after `POST /auth/passwordless/send`.
 * Pass multiple `channels` (e.g. `['email','sms']`) when the user may have requested the code on either;
 * the server verifies the code against each resolved identity (deduped by user) until one matches.
 */
export class PasswordlessOtpCredentialsDto {
    @ApiProperty({
        description: 'Email or phone (same value as in send request)',
        example: 'user@example.com',
    })
    @IsString()
    @IsNotEmpty()
    identifier: string;

    @ApiProperty({
        description: 'Channel(s) to try in order. Use both when the client is unsure whether `identifier` is email or phone.',
        enum: ['email', 'sms'],
        isArray: true,
        example: ['email', 'sms'],
    })
    @IsArray()
    @ArrayMinSize(1)
    @ArrayUnique()
    @IsIn(['email', 'sms'], { each: true })
    channels: Array<'email' | 'sms'>;
    
    @ApiProperty({
        description: 'One-time code from email or SMS',
        example: '123456',
    })
    @IsString()
    @IsNotEmpty()
    code: string;
}
